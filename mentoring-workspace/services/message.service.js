const AppError = require("../utils/AppError");
const { toMessageDTO } = require("../utils/message.mapper");

const createMessageService = ({ messageRepository, connectRequestRepository }) => {
  const requireParticipant = async (connectRequestId, userId) => {
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session context record not found", 404, "SESSION_NOT_FOUND");
    if (![request.mentor, request.mentee].some((id) => String(id) === String(userId))) {
      throw new AppError("Not authorized to view messages for this session", 403, "NOT_SESSION_PARTICIPANT");
    }
  };

  const assertParticipant = requireParticipant;

  const getChatHistory = async (connectRequestId, userId, query = {}) => {
    await requireParticipant(connectRequestId, userId);
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 30));
    const skip = (page - 1) * limit;
    const [messages, totalCount] = await Promise.all([
      messageRepository.findPaginatedMessages(connectRequestId, skip, limit),
      messageRepository.countMessages(connectRequestId),
    ]);
    await messageRepository.markMessagesAsRead(connectRequestId, userId);
    return { messages: messages.map(toMessageDTO), totalCount, page, limit, hasMore: skip + messages.length < totalCount };
  };

  const getUnreadMessagesCount = async (connectRequestId, userId) => {
    await requireParticipant(connectRequestId, userId);
    return { unreadCount: await messageRepository.countUnreadMessages(connectRequestId, userId) };
  };

  return { assertParticipant, getChatHistory, getUnreadMessagesCount };
};

module.exports = createMessageService;
