const crypto = require("node:crypto");

const createEventEnvelope = (event, correlationId) => ({
  // Keep the command fields at the top level while old readers are migrated.
  ...event,
  eventId: event.eventId || crypto.randomUUID(),
  eventType: event.eventType || "notification.requested",
  schemaVersion: 1,
  occurredAt: event.occurredAt || new Date().toISOString(),
  producer: "mentoring-workspace",
  correlationId: correlationId || event.correlationId || "not-provided",
  payload: event,
});

const createNotificationStreamPublisher = ({ client, streamName, enabled = false }) => ({
  connect: async () => {
    if (!enabled || client.isOpen) return enabled;
    client.on("error", (error) => process.stderr.write(`Notification stream error: ${error.message}\n`));
    await client.connect();
    return true;
  },
  publish: async (event, correlationId) => {
    if (!enabled || !client.isReady) return { delivered: false, skipped: true };
    const envelope = createEventEnvelope(event || {}, correlationId);
    await client.xAdd(streamName, "*", {
      // Keep sourceEventId as a stream field for simple inspection and old readers.
      sourceEventId: event.sourceEventId || envelope.eventId,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      schemaVersion: String(envelope.schemaVersion),
      occurredAt: envelope.occurredAt,
      producer: envelope.producer,
      correlationId: envelope.correlationId,
      payload: JSON.stringify(envelope),
    }, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10000 } });
    return { delivered: true, transport: "redis-stream" };
  },
  close: async () => {
    if (client.isOpen) await client.quit();
  },
});

module.exports = createNotificationStreamPublisher;
