const express = require("express");
const AppError = require("../utils/AppError");

const createReportRouter = ({
  controller,
  authenticate,
  identityClient,
  upload,
  validations,
}) => {
  const router = express.Router();
  const requireReportRole = async (req, _res, next) => {
    try {
      if (!identityClient) {
        throw new AppError(
          "Identity role lookup is unavailable",
          503,
          "IDENTITY_UNAVAILABLE",
        );
      }
      const [user] = await identityClient.getUserSummaries(
        [req.user._id],
        req.correlationId,
      );
      if (!user?.roles?.some((role) => ["mentor", "mentee"].includes(role))) {
        throw new AppError(
          "Only mentors and mentees can submit or view reports",
          403,
          "ROLE_REQUIRED",
        );
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };

  router.use(authenticate);
  router.post(
    "/",
    requireReportRole,
    upload,
    validations.submitReportValidation,
    controller.submitReport,
  );
  router.get(
    "/my/:connectRequestId",
    requireReportRole,
    validations.getMyReportValidation,
    controller.getMyReport,
  );
  return router;
};

module.exports = createReportRouter;
