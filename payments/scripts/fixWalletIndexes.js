const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const env = require("../config/env");

const isUserOnlyUnique = (index) => {
  const keys = Object.keys(index.key || {});
  return index.unique === true && keys.length === 1 && keys[0] === "user";
};

const run = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.info("Connected to MongoDB");

    const collection = Wallet.collection;
    const before = await collection.indexes();

    console.info("Current wallet indexes:");
    for (const index of before) {
      console.info(
        `  • ${index.name} key=${JSON.stringify(index.key)}${index.unique ? " (unique)" : ""}`,
      );
    }

    const stale = before.filter(isUserOnlyUnique);
    if (stale.length === 0) {
      console.info("No stale unique user index found; nothing to drop.");
    } else {
      for (const index of stale) {
        await collection.dropIndex(index.name);
        console.info(`Dropped stale unique index: ${index.name}`);
      }
    }

    await Wallet.syncIndexes();
    console.info("Wallet indexes synced to match the schema.");

    const after = await collection.indexes();
    console.info("Wallet indexes now:");
    for (const index of after) {
      console.info(
        `  • ${index.name} key=${JSON.stringify(index.key)}${index.unique ? " (unique)" : ""}`,
      );
    }

    return { staleIndexesDropped: stale.length, after: after.length };
  } catch (error) {
    console.error("Wallet index repair failed:", error.message);
    process.exitCode = 1;
    throw error;
  } finally {
    await mongoose.disconnect();
    console.info("Disconnected from MongoDB");
  }
};

if (require.main === module) {
  run().catch(() => process.exit(1));
}

module.exports = { run, isUserOnlyUnique };
