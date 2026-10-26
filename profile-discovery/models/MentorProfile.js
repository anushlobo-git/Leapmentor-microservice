const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    fileName: {
      type: String,
      trim: true,
      default: "Untitled Document",
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const mentorProfileSchema = new mongoose.Schema(
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
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    profilePicture: { type: String, trim: true, maxlength: 2048, default: "" },
    profilePictureFileName: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
    yearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
    hourlyRate: { type: Number, min: 0, default: 0 },
    avgRating: { type: Number, min: 0, max: 5, default: 0 },
    totalSessions: { type: Number, min: 0, default: 0 },
    skills: { type: [String], default: [] },
    communicationPreferences: {
      type: [String],
      enum: ["Chat", "Email", "Video Call", "Phone Call", "In-Person"],
      default: [],
    },
    languages: { type: [String], default: ["English"] },
    linkedInUrl: { type: String, trim: true, maxlength: 1024, default: "" },
    portfolioUrl: { type: String, trim: true, maxlength: 1024, default: "" },
    isProfileComplete: { type: Boolean, default: false },
    isProfilePublished: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    verificationStatus: {
      type: String,
      enum: ["unverified", "verified", "pending"],
      default: "unverified",
      trim: true,
    },
    phoneNumber: { type: String, trim: true, maxlength: 30, default: "" },
    resumeDocument: { type: documentSchema, default: null },
    workExperienceDocuments: { type: [documentSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MentorProfile", mentorProfileSchema);
