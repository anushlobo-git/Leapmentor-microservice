const { buildEmailMessages } = require("./emailTemplates");

const createReportEmailService = ({ sendEmail, emailDeliveryRepository }) => {
  const sendEmailEvent = async (event) => {
    if (!event?.sourceEventId) {
      const error = new Error("Email event is missing its event ID");
      error.code = "INVALID_REPORT_EMAIL_EVENT";
      throw error;
    }
    const messages = buildEmailMessages(event);
    if (!messages.length) {
      const error = new Error("Unsupported or incomplete email event");
      error.code = "UNSUPPORTED_EMAIL_EVENT";
      throw error;
    }

    let deduplicated = true;
    for (const [index, message] of messages.entries()) {
      const deliveryId =
        messages.length === 1
          ? event.sourceEventId
          : `${event.sourceEventId}:${index}`;
      const previous =
        await emailDeliveryRepository.findBySourceEventId(deliveryId);
      if (previous?.status === "sent") continue;
      deduplicated = false;
      if (!previous) {
        try {
          await emailDeliveryRepository.createPending(deliveryId, event);
        } catch (error) {
          if (error?.code !== 11000) throw error;
          const duplicate =
            await emailDeliveryRepository.findBySourceEventId(deliveryId);
          if (duplicate?.status === "sent") continue;
        }
      }

      if (emailDeliveryRepository.claimForSending) {
        const claimed =
          await emailDeliveryRepository.claimForSending(deliveryId);
        if (!claimed) continue;
      }

      try {
        await sendEmail(message);
        await emailDeliveryRepository.markSent(deliveryId);
      } catch (error) {
        await emailDeliveryRepository
          .markFailed(deliveryId, error.message)
          .catch(() => null);
        throw error;
      }
    }
    return { sent: true, deduplicated };
  };

  const drainPendingEmailEvents = async () => {
    if (!emailDeliveryRepository.findPending) return { attempted: 0, sent: 0 };
    const events = await emailDeliveryRepository.findPending(50);
    let sent = 0;
    for (const record of events) {
      try {
        const result = await sendEmailEvent(record.payload);
        if (result.sent) sent += 1;
      } catch {
        // The delivery record retains the failure and is retried on the next drain.
      }
    }
    return { attempted: events.length, sent };
  };

  return {
    sendEmailEvent,
    sendReportEvent: sendEmailEvent,
    drainPendingEmailEvents,
  };
};

module.exports = createReportEmailService;
