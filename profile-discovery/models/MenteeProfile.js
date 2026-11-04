const mongoose = require("mongoose");

const menteeProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    currentRole: { type: String, trim: true, maxlength: 150, default: "" },
    industry: { type: String, trim: true, maxlength: 150, default: "" },
    company: { type: String, trim: true, maxlength: 150, default: "" },
    yearsOfExperience: { type: String, trim: true, maxlength: 50, default: "" },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    profilePicture: { type: String, trim: true, maxlength: 2048, default: "" },
    profilePictureFileName: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
    linkedInUrl: { type: String, trim: true, maxlength: 1024, default: "" },
    portfolioUrl: { type: String, trim: true, maxlength: 1024, default: "" },
    skills: { type: [String], default: [] },
    interestedFields: { type: [String], default: [] },
    communicationPreferences: {
      type: [String],
      enum: ["Chat", "Email", "Video Call", "Phone Call", "In-Person"],
      default: [],
    },
    languages: { type: [String], default: ["English"] },
    isProfileComplete: { type: Boolean, default: false },
    isProfilePublished: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    marketingPreferences: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MenteeProfile", menteeProfileSchema);
