const configureRedisAdapter = async ({
  io,
  enabled,
  url,
  createClient,
  createAdapter,
  logger = console,
}) => {
  if (!enabled) return { enabled: false, close: async () => {} };
  if (!url)
    throw new Error(
      "REDIS_URL is required when the Socket.IO Redis adapter is enabled",
    );

  const pubClient = createClient({ url });
  const subClient = pubClient.duplicate();
  pubClient.on("error", (error) =>
    logger.error?.("Socket.IO Redis publisher error", error),
  );
  subClient.on("error", (error) =>
    logger.error?.("Socket.IO Redis subscriber error", error),
  );

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
  } catch (error) {
    await Promise.allSettled([
      pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
      subClient.isOpen ? subClient.quit() : Promise.resolve(),
    ]);
    throw error;
  }

  return {
    enabled: true,
    close: async () => {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    },
  };
};

module.exports = configureRedisAdapter;
