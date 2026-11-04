const { createClient } = require("redis");
const env = require("../config/env");
const createNotificationConsumer = require("../streams/notificationConsumer");

const replay = async (deadLetterId) => {
  if (!deadLetterId)
    throw new Error("Usage: npm run replay:notification -- <dead-letter-id>");
  const client = createClient({ url: env.redisUrl });
  await client.connect();
  try {
    const consumer = createNotificationConsumer({
      client,
      streamName: env.notificationStreamName,
      groupName: env.notificationConsumerGroup,
      consumerName: `replay-${process.pid}`,
      notificationService: {},
      enabled: false,
    });
    const result = await consumer.replayDeadLetter(deadLetterId);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.replayed) process.exitCode = 1;
  } finally {
    await client.quit();
  }
};

if (require.main === module) {
  replay(process.argv[2]).catch((error) => {
    process.stderr.write(`Notification replay failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = replay;
