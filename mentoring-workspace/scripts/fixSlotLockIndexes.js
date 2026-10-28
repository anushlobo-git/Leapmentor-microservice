const mongoose = require("mongoose");
const SlotLock = require("../models/SlotLock");
const env = require("../config/env");

const isStaleLockedByUnique = (index) =>
  index.unique === true &&
  Object.prototype.hasOwnProperty.call(index.key || {}, "lockedBy");

const dedupeConflictingLocks = async (collection) => {
  const groups = await collection
    .aggregate([
      {
        $group: {
          _id: {
            mentorId: "$mentorId",
            date: "$date",
            startTime: "$startTime",
            endTime: "$endTime",
          },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (groups.length === 0) {
    console.info("No duplicate slot locks found; nothing to dedupe.");
    return { removed: 0, groupCount: 0 };
  }

  let removed = 0;
  for (const group of groups) {
    const [, ...extras] = group.ids;
    if (extras.length) {
      const result = await collection.deleteMany({ _id: { $in: extras } });
      removed += result.deletedCount || 0;
    }
  }

  console.info(
    `Removed ${removed} duplicate lock(s) across ${groups.length} conflicting slot(s).`,
  );
  return { removed, groupCount: groups.length };
};

const run = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.info("Connected to MongoDB");

    const collection = SlotLock.collection;
    const before = await collection.indexes();

    console.info("Current slot-lock indexes:");
    for (const index of before) {
      console.info(
        `  • ${index.name} key=${JSON.stringify(index.key)}${index.unique ? " (unique)" : ""}`,
      );
    }

    const duplicates = await dedupeConflictingLocks(collection);
    const stale = before.filter(isStaleLockedByUnique);

    if (stale.length === 0) {
      console.info("No stale lockedBy unique index found; nothing to drop.");
    } else {
      for (const index of stale) {
        await collection.dropIndex(index.name);
        console.info(`Dropped stale unique index: ${index.name}`);
      }
    }

    await SlotLock.syncIndexes();
    console.info("SlotLock indexes synced to match the schema.");

    const after = await collection.indexes();
    console.info("Slot-lock indexes now:");
    for (const index of after) {
      console.info(
        `  • ${index.name} key=${JSON.stringify(index.key)}${index.unique ? " (unique)" : ""}`,
      );
    }

    return { duplicateRemoval: duplicates, after: after.length };
  } catch (error) {
    console.error("SlotLock index repair failed:", error.message);
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

module.exports = { run, dedupeConflictingLocks, isStaleLockedByUnique };
