const crypto = require("node:crypto");

const createNotificationClient = ({
  httpClient,
  serviceToken,
  streamPublisher,
  outboxRepository,
}) => {
  const deliver = async (outboxEvent) => {
    const event = outboxEvent.payload;
    const correlationId = outboxEvent.correlationId;

    if (streamPublisher) {
      try {
        const streamResult = await streamPublisher.publish(
          event,
          correlationId,
        );
        if (streamResult?.delivered) {
          await outboxRepository?.markDelivered(outboxEvent._id);
          return streamResult;
        }
      } catch (error) {
        process.stderr.write(
          `Notification stream publish failed: ${error.message}\n`,
        );
      }
    }
    if (!serviceToken) {
      await outboxRepository?.markFailed(
        outboxEvent._id,
        "NOTIFICATIONS_SERVICE_TOKEN_MISSING",
        outboxEvent.attempts,
      );
      return { delivered: false, skipped: true };
    }
    try {
      const response = await httpClient.request({
        method: "POST",
        path:
          event.eventType === "payment.invoice.email"
            ? "/internal/v1/email-events/invoice-events"
            : event.eventType?.endsWith(".email")
              ? "/internal/v1/email-events/report-events"
              : "/internal/v1/notifications",
        body: event,
        correlationId,
        idempotencyKey: event.sourceEventId,
      });
      await outboxRepository?.markDelivered(outboxEvent._id);
      return { delivered: true, ...(response?.data || {}) };
    } catch (error) {
      await outboxRepository?.markFailed(
        outboxEvent._id,
        error.code || "NOTIFICATION_PUBLISH_FAILED",
        outboxEvent.attempts,
      );
      process.stderr.write(`Notification publish failed: ${error.message}\n`);
      return {
        delivered: false,
        error: error.code || "NOTIFICATION_PUBLISH_FAILED",
      };
    }
  };

  const publish = async (event, correlationId) => {
    const eventWithCorrelation =
      correlationId && !event?.correlationId
        ? { ...event, correlationId }
        : event;
    if (!outboxRepository) {
      return deliver({
        _id: null,
        payload: eventWithCorrelation,
        correlationId,
      });
    }
    const sourceEventId =
      eventWithCorrelation?.sourceEventId || crypto.randomUUID();
    const outboxEvent = await outboxRepository.enqueue({
      eventId: crypto.randomUUID(),
      sourceEventId,
      eventType: "notification.requested",
      payload: { ...eventWithCorrelation, sourceEventId },
      correlationId,
    });
    return deliver(outboxEvent);
  };

  let draining = false;
  const drain = async () => {
    if (!outboxRepository) return { attempted: 0 };
    if (draining) return { attempted: 0, skipped: true };
    draining = true;
    try {
      const pendingEvents = await outboxRepository.findPending();
      let delivered = 0;
      for (const outboxEvent of pendingEvents) {
        const result = await deliver(outboxEvent);
        if (result?.delivered) delivered += 1;
      }
      return { attempted: pendingEvents.length, delivered };
    } finally {
      draining = false;
    }
  };

  return { publish, drain };
};

module.exports = createNotificationClient;
