const createTtlCache = () => {
  const entries = new Map();

  const getOrSet = async (key, ttlSeconds, factory) => {
    const existing = entries.get(key);
    if (existing && existing.expiresAt > Date.now()) return existing.value;

    const value = await factory();
    entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return value;
  };

  const clear = (key) => entries.delete(key);

  return { getOrSet, clear };
};

module.exports = createTtlCache;
