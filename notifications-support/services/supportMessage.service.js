const AppError = require("../utils/AppError");
const { toSupportMessageDTO } = require("../utils/supportMessage.mapper");

const createSupportMessageService = ({ supportMessageRepository, notificationService }) => {
  const submitTicket = async (inputData) => {
    const { email, subject, message, role, user } = inputData || {};
    if (!email || !subject || !message) throw new AppError("All fields (email, subject, message) are required", 400, "INVALID_SUPPORT_TICKET");
    const ticket = await supportMessageRepository.create({
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      role: role || "user",
      user: user || null,
      status: "open",
    });
    return toSupportMessageDTO(ticket);
  };

  const fetchAllTickets = async () => (await supportMessageRepository.findAllSortedByNewest()).map(toSupportMessageDTO);

  const resolveTicket = async (ticketId) => {
    const ticket = await supportMessageRepository.updateStatusById(ticketId, "resolved");
    if (!ticket) throw new AppError("Support ticket not found", 404, "SUPPORT_TICKET_NOT_FOUND");
    if (ticket.user && notificationService) {
      await notificationService.createFromEvent({
        sourceEventId: `support.ticket:${ticket._id}:resolved`,
        recipient: ticket.user,
        type: "support_resolved",
        title: "Support ticket resolved",
        message: `Your support request "${ticket.subject}" has been resolved by our team.`,
        metadata: { ticketId: ticket._id },
      });
    }
    return toSupportMessageDTO(ticket);
  };

  return { submitTicket, fetchAllTickets, resolveTicket };
};

module.exports = createSupportMessageService;
