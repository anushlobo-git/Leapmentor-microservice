const AppError = require("../utils/AppError");

const ROLE_MENTEE = "mentee";
const ROLE_MENTOR = "mentor";

const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || value;

const createEscrowService = ({
  walletRepository,
  transactionRepository,
  workspaceClient,
  runInTransaction,
  commissionRate = 20,
  getCommissionRate = async () => commissionRate,
}) => {
  const requireAmount = (value, label) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 1) {
      throw new AppError(`${label} must be at least 1`, 400, "INVALID_PAYMENT_AMOUNT");
    }
    return amount;
  };

  const getContext = (requestId, correlationId) =>
    workspaceClient.getPaymentContext(requestId, correlationId);

  const requireParticipant = (context, userId) => {
    const user = idOf(userId);
    const isMentee = idOf(context.mentee) === user;
    const isMentor = idOf(context.mentor) === user;
    if (!isMentee && !isMentor) {
      throw new AppError("Not authorized for this connect request", 403, "NOT_REQUEST_PARTICIPANT");
    }
    return { isMentee, isMentor };
  };

  const pay = async ({ connectRequestId, sessionRate, sessionCount, menteeId, correlationId }) => {
    if (!connectRequestId) throw new AppError("connectRequestId is required", 400);
    const rate = requireAmount(sessionRate, "sessionRate");
    const count = requireAmount(sessionCount, "sessionCount");
    const context = await getContext(connectRequestId, correlationId);
    if (idOf(context.mentee) !== idOf(menteeId)) throw new AppError("Not authorized to pay for this request", 403);
    if (context.status !== "accepted") throw new AppError(`Payment only allowed on accepted requests. Current status: ${context.status}`, 400);
    if (context.paymentStatus === "paid") throw new AppError("Payment already made for this session", 409);

    const activeCommissionRate = await getCommissionRate();
    const fee = Math.ceil((rate * count * activeCommissionRate) / 100);
    const totalAmount = rate * count + fee;
    const local = await runInTransaction(async (session) => {
      const wallet = await walletRepository.findByUserIdAndRole(menteeId, ROLE_MENTEE, session);
      if (!wallet) throw new AppError("Mentee wallet not found", 404);
      if (wallet.balance < totalAmount) throw new AppError(`Insufficient balance. You have ${wallet.balance} tokens but need ${totalAmount}`, 400);
      wallet.balance -= totalAmount;
      wallet.escrow += totalAmount;
      await walletRepository.save(wallet, session);
      await transactionRepository.createMany([{
        user: menteeId,
        type: "escrow_hold",
        amount: totalAmount,
        connectRequest: connectRequestId,
         description: `Escrow hold — ${count} session(s) × ${rate} tokens + ${activeCommissionRate}% platform fee`,
        balanceAfter: wallet.balance,
      }], session);
      return { balance: wallet.balance, escrow: wallet.escrow };
    });

    await workspaceClient.updatePaymentState(connectRequestId, {
      sessionRate: rate,
      sessionCount: count,
      totalAmount,
      commissionRate: activeCommissionRate,
      commissionAmount: fee,
      mentorPayout: rate * count,
      paymentStatus: "paid",
      status: "ongoing",
      paidAt: new Date(),
    }, correlationId);

    return {
      mentorAmount: rate * count,
      platformFee: fee,
      totalAmount,
      commissionRate: activeCommissionRate,
      ...local,
      paymentStatus: "paid",
      status: "ongoing",
    };
  };

  const payAdditional = async ({ connectRequestId, sessionRate, slotId, menteeId, correlationId }) => {
    if (!connectRequestId || !slotId) throw new AppError("connectRequestId, sessionRate, and slotId are required", 400);
    const rate = requireAmount(sessionRate, "sessionRate");
    const context = await getContext(connectRequestId, correlationId);
    if (idOf(context.mentee) !== idOf(menteeId)) throw new AppError("Not authorized to pay for this request", 403);
    if (context.status !== "ongoing") throw new AppError("Additional payment only allowed on ongoing sessions", 400);
    const additionalSlot = (context.additionalSlots || []).find((slot) => idOf(slot) === idOf(slotId));
    if (!additionalSlot) throw new AppError("Additional slot not found", 404);
    if (additionalSlot.paymentStatus === "paid") throw new AppError("This slot has already been paid for", 409);
    const activeCommissionRate = await getCommissionRate();
    const fee = Math.ceil((rate * activeCommissionRate) / 100);
    const totalAmount = rate + fee;
    const local = await runInTransaction(async (session) => {
      const wallet = await walletRepository.findByUserIdAndRole(menteeId, ROLE_MENTEE, session);
      if (!wallet) throw new AppError("Mentee wallet not found", 404);
      if (wallet.balance < totalAmount) throw new AppError(`Insufficient balance. You have ${wallet.balance} tokens but need ${totalAmount}`, 400);
      wallet.balance -= totalAmount;
      wallet.escrow += totalAmount;
      await walletRepository.save(wallet, session);
      await transactionRepository.createMany([{
        user: menteeId,
        type: "escrow_hold",
        amount: totalAmount,
        connectRequest: connectRequestId,
       description: `Escrow hold — additional session × ${rate} tokens + ${activeCommissionRate}% platform fee`,
        balanceAfter: wallet.balance,
      }], session);
      return { balance: wallet.balance, escrow: wallet.escrow };
    });
    await workspaceClient.updatePaymentState(connectRequestId, {
      additionalSlotId: slotId,
      paymentStatus: "paid",
      paidAt: new Date(),
      sessionRate: rate,
      totalAmount,
    }, correlationId);
    return { sessionRate: rate, platformFee: fee, totalAmount, commissionRate: activeCommissionRate, slotId, ...local };
  };

  const release = async ({ requestId, menteeId, correlationId }) => {
    const context = await getContext(requestId, correlationId);
    if (idOf(context.mentee) !== idOf(menteeId)) throw new AppError("Only the mentee can confirm session completion", 403);
    if (context.status !== "ongoing") throw new AppError(`Release only allowed on ongoing sessions. Current status: ${context.status}`, 400);
    if (context.paymentStatus !== "paid") throw new AppError("No escrowed payment found for this session", 400);
    const total = Number(context.totalAmount || 0);
    const mentorPayout = Number(context.mentorPayout || total);
    const commissionAmount = Number(context.commissionAmount || Math.max(0, total - mentorPayout));
    const local = await runInTransaction(async (session) => {
      const [menteeWallet, mentorWallet] = await Promise.all([
        walletRepository.findByUserIdAndRole(menteeId, ROLE_MENTEE, session),
        walletRepository.findByUserIdAndRole(context.mentor, ROLE_MENTOR, session),
      ]);
      if (!menteeWallet || !mentorWallet) throw new AppError("Required wallet not found", 404);
      if (menteeWallet.escrow < total) throw new AppError("Escrow balance mismatch. Contact support.", 400);
      menteeWallet.escrow -= total;
      mentorWallet.balance += mentorPayout;
      await walletRepository.save(menteeWallet, session);
      await walletRepository.save(mentorWallet, session);
      await transactionRepository.createMany([
        { user: menteeId, type: "escrow_release", amount: total, connectRequest: requestId, description: "Escrow released on session completion", balanceAfter: menteeWallet.escrow },
        { user: context.mentor, type: "commission_deduct", amount: commissionAmount, connectRequest: requestId, description: `Platform fee (${context.commissionRate ?? commissionRate}%) collected`, balanceAfter: mentorWallet.balance },
        { user: context.mentor, type: "mentor_payout", amount: mentorPayout, connectRequest: requestId, description: "Session payout — full rate received", balanceAfter: mentorWallet.balance },
      ], session);
      return { menteeEscrow: menteeWallet.escrow, mentorBalance: mentorWallet.balance };
    });
    await workspaceClient.updatePaymentState(requestId, { status: "completed", completedAt: new Date() }, correlationId);
    return { totalAmount: total, commissionRate: context.commissionRate ?? commissionRate, commissionAmount, mentorPayout, ...local, status: "completed" };
  };

  const refund = async ({ requestId, userId, correlationId }) => {
    const context = await getContext(requestId, correlationId);
    requireParticipant(context, userId);
    if (context.paymentStatus !== "paid") throw new AppError("No paid escrow found to refund", 400);
    if (context.status === "completed") throw new AppError("Cannot refund a completed session", 400);
    const total = Number(context.totalAmount || 0);
    const local = await runInTransaction(async (session) => {
      const wallet = await walletRepository.findByUserIdAndRole(context.mentee, ROLE_MENTEE, session);
      if (!wallet) throw new AppError("Mentee wallet not found", 404);
      if (wallet.escrow < total) throw new AppError("Escrow balance mismatch. Contact support.", 400);
      wallet.escrow -= total;
      wallet.balance += total;
      await walletRepository.save(wallet, session);
      await transactionRepository.createMany([{ user: context.mentee, type: "escrow_refund", amount: total, connectRequest: requestId, description: "Full refund — session cancelled (incl. platform fee)", balanceAfter: wallet.balance }], session);
      return { balance: wallet.balance, escrow: wallet.escrow };
    });
    await workspaceClient.updatePaymentState(requestId, { paymentStatus: "refunded", status: "rejected" }, correlationId);
    return { totalAmount: total, ...local, status: "rejected", paymentStatus: "refunded" };
  };

  const adminRefund = async ({ requestId, correlationId }) => {
    const context = await getContext(requestId, correlationId);
    if (context.paymentStatus !== "paid") throw new AppError("No paid escrow found to refund", 400);
    if (context.status === "completed") throw new AppError("Cannot refund a completed session", 400);
    const total = Number(context.totalAmount || 0);
    const local = await runInTransaction(async (session) => {
      const wallet = await walletRepository.findByUserIdAndRole(context.mentee, ROLE_MENTEE, session);
      if (!wallet) throw new AppError("Mentee wallet not found", 404);
      if (wallet.escrow < total) throw new AppError("Escrow balance mismatch. Contact support.", 400);
      wallet.escrow -= total;
      wallet.balance += total;
      await walletRepository.save(wallet, session);
      await transactionRepository.createMany([{
        user: context.mentee,
        type: "escrow_refund",
        amount: total,
        connectRequest: requestId,
        description: "Admin refund — report resolved",
        balanceAfter: wallet.balance,
      }], session);
      return { balance: wallet.balance, escrow: wallet.escrow };
    });
    await workspaceClient.updatePaymentState(requestId, { paymentStatus: "refunded", status: "rejected" }, correlationId);
    return { totalAmount: total, ...local, status: "rejected", paymentStatus: "refunded" };
  };

  const getStatus = async ({ requestId, userId, correlationId }) => {
    const context = await getContext(requestId, correlationId);
    requireParticipant(context, userId);
    const wallet = await walletRepository.findByUserIdAndRole(context.mentee, ROLE_MENTEE);
    return {
      status: context.status,
      paymentStatus: context.paymentStatus,
      sessionRate: context.sessionRate ?? null,
      sessionCount: context.sessionCount ?? (context.selectedSlots?.length || null),
      totalAmount: context.totalAmount ?? null,
      paidAt: context.paidAt,
      completedAt: context.completedAt,
      confirmedSlot: context.confirmedSlot,
       commissionRate: context.commissionRate ?? await getCommissionRate(),
      wallet: wallet ? { balance: wallet.balance, escrow: wallet.escrow } : null,
    };
  };

  return { pay, payAdditional, release, refund, adminRefund, getStatus };
};

module.exports = createEscrowService;
