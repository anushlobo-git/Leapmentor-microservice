const cron = require("node-cron");
const mongoose = require("mongoose");
const Availability = require("../models/Availability");
const env = require("../config/env");
const logger = require("../utils/logger");

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const cleanupAvailability = async () => {
  try {
    const today = getTodayStr();
    logger.info("Availability cleanup started", { today });

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

    logger.info("Availability cleanup completed", {
      totalDocsUpdated,
      totalDatesRemoved,
    });

    return { totalDocsUpdated, totalDatesRemoved };
  } catch (error) {
    logger.error("Availability cleanup failed", { error });
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
        logger.error("Availability cleanup job failed", { error });
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  logger.info("Availability cleanup scheduled", { schedule: "0 0 * * *", timezone: "Asia/Kolkata" });
  return true;
};

if (require.main === module) {
  mongoose
    .connect(env.mongoUri)
    .then(async () => {
      logger.info("Connected to MongoDB for availability cleanup");
      const result = await cleanupAvailability();
      logger.info("Availability cleanup result", result);
    })
    .catch((error) => {
      logger.error("Availability cleanup failed to start", { error });
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
      logger.info("Disconnected from MongoDB");
    });
}

module.exports = { startCleanupCron, cleanupAvailability };
