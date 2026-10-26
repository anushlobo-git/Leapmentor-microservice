const createVerificationController = ({ verificationService }) => {
  const sendVerification = async (req, res, next) => {
    try {
      await verificationService.initiateVerification(req.body.email);
      return res.status(200).json({
        success: true,
        data: null,
        message: "Verification email sent (OTP + magic link)",
      });
    } catch (error) {
      return next(error);
    }
  };

  const resendVerification = async (req, res, next) => {
    try {
      await verificationService.initiateVerification(req.body.email, " (Resend)");
      return res.status(200).json({
        success: true,
        data: null,
        message: "Verification email resent (OTP + magic link)",
      });
    } catch (error) {
      return next(error);
    }
  };

  const verifyOtp = async (req, res, next) => {
    try {
      await verificationService.processOtpVerification(
        req.body.email,
        req.body.otp,
      );
      return res.status(200).json({
        success: true,
        data: null,
        message: "Email verified successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const verifyLink = async (req, res, next) => {
    try {
      const result = await verificationService.processLinkVerification(
        req.params.token,
        req.query.email,
      );
      return res.status(200).json({
        success: true,
        data: { role: result.role },
        message: "Email verified successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  return {
    sendVerification,
    resendVerification,
    verifyOtp,
    verifyLink,
  };
};

module.exports = createVerificationController;
