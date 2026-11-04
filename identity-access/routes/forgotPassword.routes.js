const express = require("express");

const createForgotPasswordRouter = ({ forgotPasswordController, validations }) => {
  const router = express.Router();

  router.post(
    "/forgot-password",
    validations.sendForgotPasswordOtpValidation,
    forgotPasswordController.sendForgotPasswordOtp,
  );
  router.post(
    "/verify-reset-otp",
    validations.verifyResetOtpValidation,
    forgotPasswordController.verifyResetOtp,
  );
  router.post(
    "/reset-password",
    validations.resetPasswordValidation,
    forgotPasswordController.resetPassword,
  );

  return router;
};

module.exports = createForgotPasswordRouter;
