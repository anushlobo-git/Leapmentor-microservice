const createForgotPasswordController = ({ forgotPasswordService }) => {
  const sendForgotPasswordOtp = async (req, res, next) => {
    try {
      const result = await forgotPasswordService.sendForgotPasswordOtp(
        req.body.email,
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Password reset OTP sent",
      });
    } catch (error) {
      return next(error);
    }
  };

  const verifyResetOtp = async (req, res, next) => {
    try {
      const result = await forgotPasswordService.verifyResetOtp(
        req.body.email,
        req.body.otp,
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Reset OTP verified",
      });
    } catch (error) {
      return next(error);
    }
  };

  const resetPassword = async (req, res, next) => {
    try {
      const result = await forgotPasswordService.resetPassword({
        email: req.body.email,
        otp: req.body.otp,
        newPassword: req.body.newPassword,
      });
      return res.status(200).json({
        success: true,
        data: result,
        message: "Password reset successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  return {
    sendForgotPasswordOtp,
    verifyResetOtp,
    resetPassword,
  };
};

module.exports = createForgotPasswordController;
