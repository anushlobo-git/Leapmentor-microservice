const AppError = require("../utils/AppError");

const IMAGE_FOLDER = "leapmentor/profiles";
const RESUME_FOLDER = "leapmentor/verification-docs/resumes";
const WORK_EXPERIENCE_FOLDER = "leapmentor/verification-docs/work-experience";
const MAX_UPLOAD_ATTEMPTS = 3;
const RETRYABLE_NETWORK_ERRORS = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EAI_AGAIN",
  "EPIPE",
]);

const extractErrorMessage = (error) => {
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch (_serializationError) {
      return "Unserializable Cloudinary error";
    }
  }
  return String(error);
};

const describeProviderError = (error) => {
  const description = {
    name: error?.name,
    message: extractErrorMessage(error),
    code: error?.http_code || error?.code,
  };

  if (Array.isArray(error?.errors)) {
    description.causes = error.errors.map((cause) => ({
      name: cause?.name,
      message: cause?.message,
      code: cause?.code,
      address: cause?.address,
      port: cause?.port,
    }));
  }

  if (error?.cause) {
    description.cause = {
      name: error.cause.name,
      message: error.cause.message,
      code: error.cause.code,
    };
  }

  return description;
};

const isRetryableUploadError = (error) =>
  error?.name === "AggregateError" ||
  RETRYABLE_NETWORK_ERRORS.has(error?.code) ||
  (Array.isArray(error?.errors) &&
    error.errors.some((cause) => RETRYABLE_NETWORK_ERRORS.has(cause?.code)));

const createUploadService = ({
  cloudinary,
  cloudinaryConfigured,
  streamifier,
  mentorProfileRepository,
  identityClient,
  workspaceClient,
  toMentorProfileDTO,
  logger = console,
}) => {
  const uploadBufferOnce = (buffer, options, mimeType) => {
    if (typeof cloudinary.uploader.upload === "function") {
      const dataUri = `data:${mimeType || "application/octet-stream"};base64,${buffer.toString("base64")}`;
      return cloudinary.uploader.upload(dataUri, options);
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        },
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });
  };

  const uploadBuffer = async (buffer, options, mimeType) => {
    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        return await uploadBufferOnce(buffer, options, mimeType);
      } catch (error) {
        const canRetry =
          attempt < MAX_UPLOAD_ATTEMPTS && isRetryableUploadError(error);
        if (!canRetry) throw error;

        logger.warn?.("Transient Cloudinary upload failure; retrying", {
          attempt,
          nextAttempt: attempt + 1,
          error: describeProviderError(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }

    throw new Error("Cloudinary upload attempts exhausted");
  };

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
    if (!filePayload)
      throw new AppError("Payload missing: No file uploaded", 400);
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
        timeout: 120000,
        display_name: imageName || filePayload.originalname,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      }, filePayload.mimetype);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        fileName: imageName || filePayload.originalname,
      };
    } catch (error) {
      logger.error?.("Cloudinary profile picture upload failed", {
        error: describeProviderError(error),
      });
      throw new AppError(
        "Failed to upload profile picture",
        500,
        "UPLOAD_FAILED",
      );
    }
  };

  const processVerificationDocuments = async (
    currentUser,
    formFields,
    filePayloads,
    { correlationId } = {},
  ) => {
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
      }, resumeFile.mimetype);
      uploadedPublicIds.push(resumeResult.public_id);

      const workResults = await Promise.all(
        workExperienceFiles.map((file) =>
          uploadBuffer(file.buffer, {
            resource_type: "raw",
            folder: WORK_EXPERIENCE_FOLDER,
            unique_filename: true,
            display_name: file.originalname,
            use_filename: false,
          }, file.mimetype),
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
      try {
        const [mentor] = await identityClient.getUserSummaries(
          [currentUser._id],
          correlationId,
        );
        if (mentor?.email) {
          await workspaceClient.queueEmailEvent(
            {
              eventType: "profile.documents-submitted.email",
              sourceEventId: `profile-documents-submitted:${currentUser._id}:${resumeResult.public_id}`,
              mentorName: mentor.name,
              mentorEmail: mentor.email,
            },
            correlationId,
          );
        }
      } catch (emailError) {
        logger.warn?.("Verification document email could not be queued", {
          userId: String(currentUser._id),
          error: emailError.message,
        });
      }
      return toMentorProfileDTO(profile);
    } catch (error) {
      logger.error?.("Verification upload failed, initiating rollback", {
        userId: currentUser._id,
        error: describeProviderError(error),
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
