const createNotificationConsumer = ({
  client,
  streamName,
  groupName,
  consumerName,
  notificationService,
  reportEmailService = null,
  enabled = false,
}) => {
  let stopped = false;
  let loopPromise = null;

  const ensureGroup = async () => {
    try {
      await client.xGroupCreate(streamName, groupName, "0", { MKSTREAM: true });
    } catch (error) {
      if (!String(error.message).includes("BUSYGROUP")) throw error;
    }
  };

  const consume = async () => {
    while (!stopped) {
      const claimed = await claimPending();
      if (claimed.length) {
        await processRecords(claimed);
        continue;
      }
      const batches = await client.xReadGroup(
        groupName,
        consumerName,
        [{ key: streamName, id: ">" }],
        { COUNT: 10, BLOCK: 1000 },
      );
      if (!batches) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }
      await processRecords(batches.flatMap((batch) => batch.messages));
    }
  };

  const processRecords = async (records) => {
    for (const record of records) {
      try {
        const parsed = JSON.parse(record.message.payload);
        // New records use the shared envelope. The fallback keeps older records
        // readable while the stream is being migrated.
        const event =
          parsed?.payload && parsed?.eventId
            ? {
                ...parsed.payload,
                sourceEventId: parsed.payload.sourceEventId || parsed.eventId,
              }
            : parsed;
        if (
          event.eventType === "report.submitted.email" ||
          event.eventType === "report.resolved.email" ||
          event.eventType === "payment.invoice.email"
        ) {
          if (!reportEmailService)
            throw new Error("Report email delivery is not configured");
          await reportEmailService.sendReportEvent(event);
        } else {
          await notificationService.createFromEvent(event);
        }
        await client.xAck(streamName, groupName, record.id);
      } catch (error) {
        process.stderr.write(
          `Notification event processing failed: ${error.message}\n`,
        );
      }
    }
  };

  const claimPending = async () => {
    if (typeof client.xAutoClaim !== "function") return [];
    const result = await client.xAutoClaim(
      streamName,
      groupName,
      consumerName,
      60000,
      "0-0",
      { COUNT: 10 },
    );
    if (Array.isArray(result)) return result[1] || [];
    return result?.messages || [];
  };

  const start = async () => {
    if (!enabled || loopPromise) return enabled;
    client.on("error", (error) =>
      process.stderr.write(
        `Notification consumer Redis error: ${error.message}\n`,
      ),
    );
    if (!client.isOpen) await client.connect();
    await ensureGroup();
    stopped = false;
    loopPromise = consume().catch((error) => {
      process.stderr.write(`Notification consumer stopped: ${error.message}\n`);
      loopPromise = null;
    });
    return true;
  };

  const stop = async () => {
    stopped = true;
    if (client.isOpen) await client.quit();
    if (loopPromise) await loopPromise;
    loopPromise = null;
  };

  return { start, stop, ensureGroup };
};

module.exports = createNotificationConsumer;
