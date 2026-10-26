const express = require("express");

const createUploadRouter = ({
  uploadController,
  authenticate,
  requireRole,
  uploadMiddleware,
  validations,
}) => {
  const router = express.Router();

  router.post(
    "/profile-picture",
    authenticate,
    uploadMiddleware.profilePictureUpload,
    uploadController.uploadProfilePicture,
  );
  router.post(
    "/verification-documents",
    authenticate,
    requireRole("mentor"),
    uploadMiddleware.verificationDocumentsUpload,
    validations.verificationDocumentsValidation,
    uploadController.uploadVerificationDocuments,
  );

  return router;
};

module.exports = createUploadRouter;
