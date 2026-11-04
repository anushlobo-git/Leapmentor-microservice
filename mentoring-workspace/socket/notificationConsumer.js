const createNotificationRealtimeConsumer = ({ client, streamName, groupName, consumerName, realtimePublisher, enabled = false }) => {
  let stopped = false;
  let loopPromise = null;
  const ensureGroup = async () => {
    try { await client.xGroupCreate(streamName, groupName, "0", { MKSTREAM: true }); }
    catch (error) { if (!String(error.message).includes("BUSYGROUP")) throw error; }
  };
  const processRecords = async (records) => {
    for (const record of records) {
      try {
        const event = JSON.parse(record.message.payload);
        if (event.eventType === "notification.created") {
          const payload = event.payload || {};
          realtimePublisher.publishToUser(payload.recipient, "notification.created", payload.notification || payload);
        }
        await client.xAck(streamName, groupName, record.id);
      } catch (error) { process.stderr.write(`Realtime notification event failed: ${error.message}\n`); }
    }
  };
  const consume = async () => {
    while (!stopped) {
      const batches = await client.xReadGroup(groupName, consumerName, [{ key: streamName, id: ">" }], { COUNT: 10, BLOCK: 1000 });
      if (batches) await processRecords(batches.flatMap((batch) => batch.messages));
    }
  };
  const start = async () => {
    if (!enabled || loopPromise) return enabled;
    if (!client.isOpen) await client.connect();
    await ensureGroup();
    stopped = false;
    loopPromise = consume().catch((error) => process.stderr.write(`Realtime consumer stopped: ${error.message}\n`));
    return true;
  };
  const stop = async () => { stopped = true; if (client.isOpen) await client.quit(); if (loopPromise) await loopPromise; loopPromise = null; };
  return { start, stop, ensureGroup };
};

module.exports = createNotificationRealtimeConsumer;
