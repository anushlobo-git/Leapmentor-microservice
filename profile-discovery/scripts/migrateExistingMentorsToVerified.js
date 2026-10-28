const mongoose = require("mongoose");
const MentorProfile = require("../models/MentorProfile");
const env = require("../config/env");

const migrate = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.info("Connected to MongoDB");

    const result = await MentorProfile.updateMany(
      { verificationStatus: { $exists: false } },
      {
        $set: {
          verificationStatus: "verified",
          phoneNumber: "",
          resumeDocument: null,
          workExperienceDocuments: [],
        },
      },
    );

    console.info(
      `Migration complete — ${result.modifiedCount} mentor profile(s) marked as verified`,
    );
    return result;
  } catch (error) {
    console.error("Migration failed:", error.message);
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
