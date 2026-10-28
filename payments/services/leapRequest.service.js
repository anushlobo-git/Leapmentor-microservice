const AppError = require("../utils/AppError");
const { toLeapRequestDTO } = require("../utils/leapRequest.mapper");

const PENDING = "pending";
const MENTEE_ROLE = "mentee";
const GRANT_AMOUNT = 500;
const MAX_BALANCE = 500;

const createLeapRequestService = ({
  leapRequestRepository,
  walletRepository,
  transactionRepository,
  runInTransaction,
}) => {
  const getMyPendingRequest = async (menteeId) =>
    toLeapRequestDTO(
      await leapRequestRepository.findLatestByMenteeAndStatus(
        menteeId,
        PENDING,
      ),
    );

  const createLeapRequest = async (menteeId) => {
    try {
      const request = await runInTransaction(async (session) => {
        const existing =
          await leapRequestRepository.findLatestByMenteeAndStatus(
            menteeId,
            PENDING,
            session,
          );
        if (existing) {
          throw new AppError(
            "A pending points allocation request already exists for this user profile.",
            409,
            "LEAP_REQUEST_EXISTS",
          );
        }

        const wallet = await walletRepository.findWalletByUserAndRole(
          menteeId,
          MENTEE_ROLE,
          session,
        );
        const currentBalance = wallet?.balance ?? 0;
        if (currentBalance >= MAX_BALANCE) {
          throw new AppError(
            `Allocation blocked. You still have active points remaining (${currentBalance} LP).`,
            400,
            "LEAP_BALANCE_TOO_HIGH",
          );
        }
        return leapRequestRepository.create(
          { mentee: menteeId, currentBalance },
          session,
        );
      });
      return toLeapRequestDTO(request);
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError(
          "A pending points allocation request already exists for this user profile.",
          409,
          "LEAP_REQUEST_EXISTS",
        );
      }
      throw error;
    }
  };

  const getAllLeapRequests = async (status) => {
    const requests = await leapRequestRepository.findAll(
      status ? { status } : {},
    );
    return requests.map(toLeapRequestDTO);
  };

  const getPendingCount = () => leapRequestRepository.countByStatus(PENDING);

  const approveLeapRequest = (requestId, adminId) =>
    runInTransaction(async (session) => {
      const request = await leapRequestRepository.findById(requestId, session);
      if (!request)
        throw new AppError(
          "Points processing target context request not found.",
          404,
          "LEAP_REQUEST_NOT_FOUND",
        );
      if (request.status !== PENDING)
        throw new AppError(
          "This request workflow has already been closed and processed.",
          409,
          "LEAP_REQUEST_CLOSED",
        );

      const menteeId = request.mentee?._id ?? request.mentee;
      const wallet = await walletRepository.findByUserIdAndRole(
        menteeId,
        MENTEE_ROLE,
        session,
      );
      if (!wallet)
        throw new AppError("Mentee wallet not found.", 404, "WALLET_NOT_FOUND");

      wallet.balance += GRANT_AMOUNT;
      await walletRepository.save(wallet, session);
      await transactionRepository.createTransaction(
        {
          user: menteeId,
          type: "credit",
          amount: GRANT_AMOUNT,
          description: "Approved Leap Points allocation",
          balanceAfter: wallet.balance,
        },
        session,
      );

      request.status = "approved";
      request.reviewedAt = new Date();
      request.reviewedBy = adminId;
      await leapRequestRepository.save(request, session);
      return { newBalance: wallet.balance, request: toLeapRequestDTO(request) };
    });

  const rejectLeapRequest = (requestId, adminId) =>
    runInTransaction(async (session) => {
      const request = await leapRequestRepository.findById(requestId, session);
      if (!request)
        throw new AppError(
          "Points processing target context request not found.",
          404,
          "LEAP_REQUEST_NOT_FOUND",
        );
      if (request.status !== PENDING)
        throw new AppError(
          "This request workflow has already been closed and processed.",
          409,
          "LEAP_REQUEST_CLOSED",
        );
      request.status = "rejected";
      request.reviewedAt = new Date();
      request.reviewedBy = adminId;
      await leapRequestRepository.save(request, session);
      return toLeapRequestDTO(request);
    });

  return {
    getMyPendingRequest,
    createLeapRequest,
    getAllLeapRequests,
    getPendingCount,
    approveLeapRequest,
    rejectLeapRequest,
  };
};

module.exports = createLeapRequestService;
