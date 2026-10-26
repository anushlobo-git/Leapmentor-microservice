const AppError = require("../utils/AppError");

const IMAGE_FOLDER = "leapmentor/profiles";
const RESUME_FOLDER = "leapmentor/verification-docs/resumes";
const WORK_EXPERIENCE_FOLDER = "leapmentor/verification-docs/work-experience";

const extractErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object") return JSON.stringify(error);
  return String(error);
};

const createUploadService = ({
  cloudinary,
  cloudinaryConfigured,
  streamifier,
  mentorProfileRepository,
  toMentorProfileDTO,
  logger = console,
}) => {
  const uploadBuffer = (buffer, options) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(new Error(extractErrorMessage(error)));
        return resolve(result);
      });
      streamifier.createReadStream(buffer).pipe(stream);
    });

  const ensureProvider = () => {
    if (!cloudinaryConfigured) {
      throw new AppError(
        "Cloudinary upload is not configured",
        503,
        "UPLOAD_PROVIDER_NOT_CONFIGURED",
      );
    }
  };

  const processProfilePicture = async (filePayload, imageName) => {
    if (!filePayload) throw new AppError("Payload missing: No file uploaded", 400);
    if (!filePayload.mimetype?.startsWith("image/")) {
      throw new AppError("Only image files allowed for profile pictures", 400);
    }
    ensureProvider();

    try {
      const result = await uploadBuffer(filePayload.buffer, {
        folder: IMAGE_FOLDER,
        resource_type: "image",
        use_filename: false,
        unique_filename: true,
        display_name: imageName || filePayload.originalname,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        fileName: imageName || filePayload.originalname,
      };
    } catch (error) {
      logger.error?.("Cloudinary profile picture upload failed", {
        error: error.message,
      });
      throw new AppError("Failed to upload profile picture", 500, "UPLOAD_FAILED");
    }
  };

  const processVerificationDocuments = async (currentUser, formFields, filePayloads) => {
    const resumeFile = filePayloads?.resume?.[0];
    const workExperienceFiles = filePayloads?.workExperienceDocs || [];
    const phoneNumber = String(formFields?.phoneNumber || "").trim();

    if (!resumeFile) throw new AppError("Resume is required", 400);
    if (!phoneNumber) throw new AppError("Phone number is required", 400);
    ensureProvider();

    const uploadedPublicIds = [];
    try {
      const resumeResult = await uploadBuffer(resumeFile.buffer, {
        resource_type: "raw",
        folder: RESUME_FOLDER,
        unique_filename: true,
        display_name: resumeFile.originalname,
        use_filename: false,
      });
      uploadedPublicIds.push(resumeResult.public_id);

      const workResults = await Promise.all(
        workExperienceFiles.map((file) =>
          uploadBuffer(file.buffer, {
            resource_type: "raw",
            folder: WORK_EXPERIENCE_FOLDER,
            unique_filename: true,
            display_name: file.originalname,
            use_filename: false,
          }),
        ),
      );
      workResults.forEach((result) => uploadedPublicIds.push(result.public_id));

      const profile = await mentorProfileRepository.findOneAndUpdateByUserId(
        currentUser._id,
        {
          phoneNumber,
          resumeDocument: {
            url: resumeResult.secure_url,
            publicId: resumeResult.public_id,
            fileName: resumeFile.originalname,
            uploadedAt: new Date(),
          },
          workExperienceDocuments: workResults.map((result, index) => ({
            url: result.secure_url,
            publicId: result.public_id,
            fileName: workExperienceFiles[index].originalname,
            uploadedAt: new Date(),
          })),
          verificationStatus: "pending",
        },
      );

      if (!profile) throw new Error("Profile not found");
      return toMentorProfileDTO(profile);
    } catch (error) {
      logger.error?.("Verification upload failed, initiating rollback", {
        userId: currentUser._id,
        error: error.message,
      });
      await Promise.all(
        uploadedPublicIds.map((publicId) =>
          cloudinary.uploader
            .destroy(publicId, { resource_type: "raw" })
            .catch((rollbackError) =>
              logger.warn?.("Rollback cleanup failed", {
                publicId,
                error: rollbackError.message,
              }),
            ),
        ),
      );
      if (error instanceof AppError) throw error;
      throw new AppError(
        "System could not process documents. Please try again.",
        500,
        "VERIFICATION_UPLOAD_FAILED",
      );
    }
  };

  return { processProfilePicture, processVerificationDocuments };
};

module.exports = createUploadService;
