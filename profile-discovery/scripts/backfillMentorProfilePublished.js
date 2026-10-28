const mongoose = require("mongoose");
const MentorProfile = require("../models/MentorProfile");
const env = require("../config/env");

const migrate = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.info("Connected to MongoDB");

    const filter = {
      $or: [
        { isProfilePublished: false },
        { isProfilePublished: null },
        { isProfilePublished: { $exists: false } },
      ],
    };

    const count = await MentorProfile.countDocuments(filter);
    console.info(`Found ${count} mentor profile(s) to backfill`);

    if (count === 0) {
      console.info("All profiles already published");
      return { matched: 0, modifiedCount: 0 };
    }

    const result = await MentorProfile.updateMany(filter, {
      $set: { isProfilePublished: true },
    });

    console.info(
      `Backfill complete — ${result.modifiedCount} profile(s) updated`,
    );
    return { matched: count, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error("Backfill failed:", error.message);
    process.exitCode = 1;
    throw error;
  } finally {
    await mongoose.disconnect();
    console.info("Disconnected from MongoDB");
  }
};

if (require.main === module) {
  migrate().catch(() => process.exit(1));
}

module.exports = { migrate };
