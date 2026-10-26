const createNotificationClient = ({ httpClient, serviceToken, streamPublisher }) => ({
  publish: async (event, correlationId) => {
    if (streamPublisher) {
      try {
        const streamResult = await streamPublisher.publish(event, correlationId);
        if (streamResult?.delivered) return streamResult;
      } catch (error) {
        process.stderr.write(`Notification stream publish failed: ${error.message}\n`);
      }
    }
    if (!serviceToken) return { delivered: false, skipped: true };
    try {
      const response = await httpClient.request({
        method: "POST",
        path: "/internal/v1/notifications",
        body: event,
        correlationId,
        idempotencyKey: event.sourceEventId,
      });
      return { delivered: true, ...(response?.data || {}) };
    } catch (error) {
      process.stderr.write(`Notification publish failed: ${error.message}\n`);
      return { delivered: false, error: error.code || "NOTIFICATION_PUBLISH_FAILED" };
    }
  },
});

module.exports = createNotificationClient;
