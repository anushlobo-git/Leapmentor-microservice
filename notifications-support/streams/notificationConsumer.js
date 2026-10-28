const createNotificationConsumer = ({
  client,
  streamName,
  groupName,
  consumerName,
  notificationService,
  reportEmailService = null,
  maxDeliveries = 5,
  enabled = false,
}) => {
  const deadLetterStreamName = `${streamName}:dead-letter`;
  const deliveryCountKey = `${streamName}:${groupName}:delivery-counts`;
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
        await client.hDel?.(deliveryCountKey, record.id);
      } catch (error) {
        try {
          const attempts = await client.hIncrBy(deliveryCountKey, record.id, 1);
          if (attempts >= maxDeliveries) {
            await client.xAdd(deadLetterStreamName, "*", {
              sourceStream: streamName,
              sourceMessageId: String(record.id),
              payload: String(record.message.payload || ""),
              error: String(error.message || error).slice(0, 1000),
              deliveryAttempts: String(attempts),
              failedAt: new Date().toISOString(),
            });
            await client.xAck(streamName, groupName, record.id);
            await client.hDel(deliveryCountKey, record.id);
            process.stderr.write(
              `Notification event dead-lettered: ${record.id}\n`,
            );
          } else {
            process.stderr.write(
              `Notification event processing failed (${attempts}/${maxDeliveries}): ${error.message}\n`,
            );
          }
        } catch (deadLetterError) {
          process.stderr.write(
            `Notification event retry bookkeeping failed: ${deadLetterError.message}\n`,
          );
        }
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

  const replayDeadLetter = async (deadLetterId) => {
    const records = await client.xRange(
      deadLetterStreamName,
      deadLetterId,
      deadLetterId,
      { COUNT: 1 },
    );
    const record = records?.[0];
    if (!record) return { replayed: false, reason: "dead-letter-not-found" };
    await client.xAdd(streamName, "*", { payload: record.message.payload });
    await client.xDel(deadLetterStreamName, record.id);
    return { replayed: true, sourceMessageId: record.message.sourceMessageId };
  };

  return { start, stop, ensureGroup, replayDeadLetter, deadLetterStreamName };
};

module.exports = createNotificationConsumer;
