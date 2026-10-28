// services/mentoring-workspace/clients/cloudinaryClient.js
const AppError = require("../utils/AppError");

const RAW_RESOURCE_TYPE = "raw";

// Same upload options the monolith used for note files.
const DEFAULT_UPLOAD_OPTIONS = {
  resource_type: RAW_RESOURCE_TYPE,
  use_filename: true,
  unique_filename: true,
  timeout: 120000,
  chunk_size: 6000000,
};

const extractErrorMessage = (error) => {
  if (error?.message) return error.message;
  if (typeof error === "object") return JSON.stringify(error);
  return String(error);
};

/**
 * Thin wrapper around the Cloudinary SDK so services depend on two small
 * operations instead of the SDK. The SDK and streamifier are injected, which
 * keeps tests off the network.
 */
const createCloudinaryClient = ({ cloudinary, streamifier, configured }) => {
  const ensureConfigured = () => {
    if (!configured) {
      throw new AppError(
        "Cloudinary upload is not configured",
        503,
        "UPLOAD_PROVIDER_NOT_CONFIGURED",
      );
    }
  };

  const uploadRawBuffer = async (buffer, options = {}) => {
    ensureConfigured();

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { ...DEFAULT_UPLOAD_OPTIONS, ...options },
        (error, uploadResult) => {
          if (error) {
            const failure = new Error(extractErrorMessage(error));
            failure.code = "CLOUDINARY_UPLOAD_FAILED";
            return reject(failure);
          }
          return resolve(uploadResult);
        },
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });

    return { url: result.secure_url, publicId: result.public_id };
  };

  const destroyRawAsset = async (publicId) => {
    ensureConfigured();
    return cloudinary.uploader.destroy(publicId, {
      resource_type: RAW_RESOURCE_TYPE,
    });
  };

  return { uploadRawBuffer, destroyRawAsset };
};

module.exports = createCloudinaryClient;
