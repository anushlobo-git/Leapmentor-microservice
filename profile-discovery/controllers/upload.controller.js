const createUploadController = ({ uploadService }) => {
  const uploadProfilePicture = async (req, res, next) => {
    try {
      const result = await uploadService.processProfilePicture(
        req.file,
        req.body?.imageName,
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Profile picture uploaded",
      });
    } catch (error) {
      return next(error);
    }
  };

  const uploadVerificationDocuments = async (req, res, next) => {
    try {
      const profile = await uploadService.processVerificationDocuments(
        req.user,
        req.body,
        req.files,
      );
      return res.status(200).json({
        success: true,
        data: profile,
        message: "Verification documents uploaded",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { uploadProfilePicture, uploadVerificationDocuments };
};

module.exports = createUploadController;
