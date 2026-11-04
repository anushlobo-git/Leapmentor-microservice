const express = require("express");

const createVerificationRouter = ({ verificationController, validations }) => {
  const router = express.Router();

  router.post(
    "/send",
    validations.emailPayloadValidation,
    verificationController.sendVerification,
  );
  router.post(
    "/resend",
    validations.emailPayloadValidation,
    verificationController.resendVerification,
  );
  router.post(
    "/verify-otp",
    validations.verifyOtpValidation,
    verificationController.verifyOtp,
  );
  router.get(
    "/verify/:token",
    validations.verifyLinkValidation,
    verificationController.verifyLink,
  );

  return router;
};

module.exports = createVerificationRouter;
