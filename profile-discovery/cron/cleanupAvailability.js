const cron = require("node-cron");
const mongoose = require("mongoose");
const Availability = require("../models/Availability");
const env = require("../config/env");

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const cleanupAvailability = async () => {
  try {
    const today = getTodayStr();
    console.info("[Cron] Running availability cleanup", { today });

    const allAvailability = await Availability.find({
      "specificDates.0": { $exists: true },
    });

    let totalDocsUpdated = 0;
    let totalDatesRemoved = 0;

    for (const availability of allAvailability) {
      const before = availability.specificDates.length;
      availability.specificDates = availability.specificDates.filter(
        (dateEntry) => dateEntry.date >= today,
      );

      const removed = before - availability.specificDates.length;
      if (removed > 0) {
        totalDatesRemoved += removed;
        totalDocsUpdated += 1;
        await availability.save();
      }
    }

    console.info("[Cron] Cleanup complete", {
      totalDocsUpdated,
      totalDatesRemoved,
    });

    return { totalDocsUpdated, totalDatesRemoved };
  } catch (error) {
    console.error("[Cron] Cleanup failed", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const startCleanupCron = () => {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await cleanupAvailability();
      } catch (error) {
        console.error("[Cron] availability cleanup job failed", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.info(
    "[Cron] Availability cleanup scheduled to run daily at midnight IST",
  );
  return true;
};

if (require.main === module) {
  mongoose
    .connect(env.mongoUri)
    .then(async () => {
      console.info("Connected to MongoDB for availability cleanup");
      const result = await cleanupAvailability();
      console.info("Cleanup result", result);
    })
    .catch((error) => {
      console.error("Availability cleanup failed to start", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
      console.info("Disconnected from MongoDB");
    });
}

module.exports = { startCleanupCron, cleanupAvailability };
