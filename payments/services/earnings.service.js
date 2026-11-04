const AppError = require("../utils/AppError");
const crypto = require("node:crypto");

const MONTHS = 6;
const WEEKS = 8;
const MAX_LIMIT = 20;

const createEarningsService = ({
  workspaceClient,
  walletRepository,
  transactionRepository,
  idempotencyRepository,
  runInTransaction,
}) => {
  const WITHDRAWAL_OPERATION = "earnings.withdraw";
  const requireMentor = (mentorId, correlationId) =>
    workspaceClient.getMentorRating(mentorId, correlationId);

  const getEarningsSummaryService = async (mentorId, correlationId) => {
    const [completed, ongoing, profile, wallet] = await Promise.all([
      workspaceClient.getMentorSessions(
        mentorId,
        { status: "completed" },
        correlationId,
      ),
      workspaceClient.getMentorSessions(
        mentorId,
        { status: "ongoing" },
        correlationId,
      ),
      requireMentor(mentorId, correlationId),
      walletRepository.findWalletByUserAndRole(mentorId, "mentor"),
    ]);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      totalEarnings: completed.reduce(
        (sum, session) => sum + (session.totalAmount || 0),
        0,
      ),
      sessionsThisMonth: completed.filter(
        (session) =>
          session.completedAt && new Date(session.completedAt) >= monthStart,
      ).length,
      avgRating: profile.avgRating || 0,
      pendingPayout: ongoing.reduce(
        (sum, session) => sum + (session.mentorPayout || 0),
        0,
      ),
      walletBalance: wallet?.balance || 0,
    };
  };

  const getEarningsChartService = async (mentorId, period, correlationId) => {
    await requireMentor(mentorId, correlationId);
    const now = new Date();
    const data = [];
    if (period === "monthly") {
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - (MONTHS - 1),
        1,
      );
      const sessions = await workspaceClient.getMentorSessions(
        mentorId,
        { status: "completed", since: startDate },
        correlationId,
      );
      for (let offset = MONTHS - 1; offset >= 0; offset -= 1) {
        const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const label = month
          .toLocaleString("en-US", { month: "short" })
          .toUpperCase();
        const amount = sessions
          .filter((session) => {
            const completedAt = new Date(session.completedAt);
            return (
              completedAt.getFullYear() === month.getFullYear() &&
              completedAt.getMonth() === month.getMonth()
            );
          })
          .reduce((sum, session) => sum + (session.totalAmount || 0), 0);
        data.push({ label, amount });
      }
    } else {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 55);
      const sessions = await workspaceClient.getMentorSessions(
        mentorId,
        { status: "completed", since: startDate },
        correlationId,
      );
      for (let offset = WEEKS - 1; offset >= 0; offset -= 1) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - offset * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const amount = sessions
          .filter((session) => {
            const completedAt = new Date(session.completedAt);
            return completedAt >= weekStart && completedAt < weekEnd;
          })
          .reduce((sum, session) => sum + (session.totalAmount || 0), 0);
        data.push({ label: `W${WEEKS - offset}`, amount });
      }
    }
    return { period, data };
  };

  const getPayoutHistoryService = async (mentorId, query, correlationId) => {
    await requireMentor(mentorId, correlationId);
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Number.parseInt(query.limit, 10) || 10);
    const response = await workspaceClient.getMentorPayouts(
      mentorId,
      {
        page,
        limit,
        search: query.search?.trim() || "",
      },
      correlationId,
    );
    const payouts = (response.payouts || []).map((payout) => {
      const slot = payout.confirmedSlot;
      let duration = "-";
      if (slot) {
        const [startHour, startMinute] = (slot.startTime || "0:0")
          .split(":")
          .map(Number);
        const [endHour, endMinute] = (slot.endTime || "0:0")
          .split(":")
          .map(Number);
        duration = `${endHour * 60 + endMinute - (startHour * 60 + startMinute)} mins`;
      }
      return {
        id: payout._id,
        date: payout.completedAt
          ? new Date(payout.completedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "-",
        menteeName: payout.mentee?.name || "-",
        menteeEmail: payout.mentee?.email || "-",
        sessionType: slot?.day || "-",
        duration,
        amount: payout.totalAmount || 0,
        status: payout.paymentStatus || "paid",
      };
    });
    return { payouts, pagination: response.pagination };
  };

  const withdrawEarningsService = async (
    mentorId,
    idempotencyKey,
    correlationId,
  ) => {
    const key = String(idempotencyKey || "").trim();
    if (key.length < 8 || key.length > 200) {
      throw new AppError(
        "A valid Idempotency-Key header is required",
        400,
        "MISSING_IDEMPOTENCY_KEY",
      );
    }
    const requestHash = crypto
      .createHash("sha256")
      .update(String(mentorId))
      .digest("hex");
    const existing = await idempotencyRepository.findByKey(key);
    if (existing) {
      if (
        existing.operation !== WITHDRAWAL_OPERATION ||
        existing.requestHash !== requestHash
      ) {
        throw new AppError(
          "Idempotency key was already used for a different request",
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status === "succeeded") return existing.responseBody;
      throw new AppError(
        "The withdrawal request is already in progress",
        409,
        "WITHDRAWAL_IN_PROGRESS",
      );
    }

    try {
      await idempotencyRepository.createPending({
        key,
        operation: WITHDRAWAL_OPERATION,
        requestHash,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const racedRequest = await idempotencyRepository.findByKey(key);
      if (
        racedRequest?.operation === WITHDRAWAL_OPERATION &&
        racedRequest.requestHash === requestHash &&
        racedRequest.status === "succeeded"
      ) {
        return racedRequest.responseBody;
      }
      throw new AppError(
        "The withdrawal request is already in progress",
        409,
        "WITHDRAWAL_IN_PROGRESS",
      );
    }

    try {
      await requireMentor(mentorId, correlationId);
      return await runInTransaction(async (session) => {
        const wallet = await walletRepository.findByUserIdAndRole(
          mentorId,
          "mentor",
          session,
        );
        if (!wallet)
          throw new AppError(
            "Wallet registration records not found.",
            404,
            "WALLET_NOT_FOUND",
          );
        if (wallet.balance <= 0)
          throw new AppError(
            "No clear liquid balances are currently available to withdraw.",
            400,
            "NO_EARNINGS_TO_WITHDRAW",
          );
        const withdrawn = wallet.balance;
        wallet.balance = 0;
        await walletRepository.save(wallet, session);
        await transactionRepository.createMany(
          [
            {
              user: mentorId,
              type: "withdrawal",
              amount: withdrawn,
              description:
                "Mentor outward payout financial withdrawal request.",
              balanceAfter: 0,
            },
          ],
          session,
        );
        const response = { withdrawn, newBalance: 0 };
        await idempotencyRepository.markSucceeded(key, response, session);
        return response;
      });
    } catch (error) {
      await idempotencyRepository.deletePending(key).catch(() => null);
      throw error;
    }
  };

  return {
    getEarningsSummaryService,
    getEarningsChartService,
    getPayoutHistoryService,
    withdrawEarningsService,
  };
};

module.exports = createEarningsService;
