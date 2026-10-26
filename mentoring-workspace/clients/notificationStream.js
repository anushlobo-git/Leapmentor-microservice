const createNotificationStreamPublisher = ({ client, streamName, enabled = false }) => ({
  connect: async () => {
    if (!enabled || client.isOpen) return enabled;
    client.on("error", (error) => process.stderr.write(`Notification stream error: ${error.message}\n`));
    await client.connect();
    return true;
  },
  publish: async (event, correlationId) => {
    if (!enabled || !client.isReady) return { delivered: false, skipped: true };
    await client.xAdd(streamName, "*", {
      sourceEventId: event.sourceEventId,
      eventType: event.type,
      correlationId: correlationId || "not-provided",
      payload: JSON.stringify(event),
    }, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10000 } });
    return { delivered: true, transport: "redis-stream" };
  },
  close: async () => {
    if (client.isOpen) await client.quit();
  },
});

module.exports = createNotificationStreamPublisher;
