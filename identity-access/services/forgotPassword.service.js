const crypto = require("node:crypto");
const AppError = require("../utils/AppError");

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const INITIAL_OTP_EXPIRY_MS = 10 * 60 * 1000;
const VERIFIED_OTP_EXPIRY_MS = 5 * 60 * 1000;
const AMBIGUOUS_SUCCESS_MESSAGE = "If this email exists, an OTP has been sent.";

const createForgotPasswordService = ({
  userRepository,
  verificationTokenRepository,
  bcrypt,
  sendEmail,
  fromEmail,
  now = () => new Date(),
  generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0"),
}) => {
  const sendForgotPasswordOtp = async (rawEmail) => {
    if (!rawEmail) throw new AppError("email is required", 400, "INVALID_EMAIL");

    const email = String(rawEmail).toLowerCase().trim();
    const user = await userRepository.findUserByEmail(email);
    if (!user) return { message: AMBIGUOUS_SUCCESS_MESSAGE };

    await verificationTokenRepository.deleteTokensByUserId(user._id);
    const plainOtp = generateOtp();
    const expiresAt = new Date(now().getTime() + INITIAL_OTP_EXPIRY_MS);
    const otp = await bcrypt.hash(plainOtp, BCRYPT_SALT_ROUNDS);

    await verificationTokenRepository.createToken({
      user: user._id,
      token: null,
      otp,
      expiresAt,
    });

    try {
      await sendEmail({
        from: fromEmail,
        to: user.email,
        subject: "LeapMentor — Reset your password",
        text: `Use this OTP to reset your LeapMentor password: ${plainOtp}. It expires in 10 minutes.`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 32px;">
              <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Reset Your Password</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">LeapMentor account recovery</p>
            </div>
            <div style="padding:28px 32px;">
              <p style="font-size:14px;color:#475569;margin:0 0 20px;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
                <p style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;margin:0;">${plainOtp}</p>
              </div>
              <p style="font-size:12px;color:#94a3b8;margin:0;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        `,
      });
    } catch (error) {
      await verificationTokenRepository.deleteTokensByUserId(user._id);
      throw new AppError(
        "Password reset email could not be sent. Please try again later.",
        503,
        error.code || "EMAIL_DELIVERY_FAILED",
      );
    }

    return { message: AMBIGUOUS_SUCCESS_MESSAGE };
  };

  const findUser = async (rawEmail) => {
    if (!rawEmail) {
      throw new AppError("email and otp are required", 400, "INVALID_RESET_INPUT");
    }
    const email = String(rawEmail).toLowerCase().trim();
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new AppError("Invalid OTP", 400, "INVALID_RESET_OTP");
    return { email, user };
  };

  const verifyResetOtp = async (rawEmail, rawOtp) => {
    if (!rawEmail || !rawOtp) {
      throw new AppError("email and otp are required", 400, "INVALID_RESET_INPUT");
    }

    const { email, user } = await findUser(rawEmail);
    const record = await verificationTokenRepository.findTokenByUserId(user._id);
    if (!record?.otp) {
      throw new AppError(
        "No reset request found. Please request a new OTP.",
        400,
        "RESET_REQUEST_NOT_FOUND",
      );
    }
    if (record.expiresAt < now()) {
      await verificationTokenRepository.deleteTokensByUserId(user._id);
      throw new AppError("OTP expired. Please request a new one.", 400, "OTP_EXPIRED");
    }

    const valid = await bcrypt.compare(String(rawOtp).trim(), record.otp);
    if (!valid) throw new AppError("Invalid OTP", 400, "INVALID_RESET_OTP");

    record.expiresAt = new Date(now().getTime() + VERIFIED_OTP_EXPIRY_MS);
    await verificationTokenRepository.saveToken(record);
    return { message: "OTP verified", email };
  };

  const resetPassword = async ({ email: rawEmail, otp: rawOtp, newPassword }) => {
    if (!rawEmail || !rawOtp || !newPassword) {
      throw new AppError("email, otp and newPassword are required", 400, "INVALID_RESET_INPUT");
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        400,
        "INVALID_PASSWORD",
      );
    }

    const { user } = await findUser(rawEmail);
    const record = await verificationTokenRepository.findTokenByUserId(user._id);
    if (!record?.otp) {
      throw new AppError("Session expired. Please start over.", 400, "RESET_SESSION_EXPIRED");
    }
    if (record.expiresAt < now()) {
      await verificationTokenRepository.deleteTokensByUserId(user._id);
      throw new AppError("Session expired. Please start over.", 400, "RESET_SESSION_EXPIRED");
    }

    const valid = await bcrypt.compare(String(rawOtp).trim(), record.otp);
    if (!valid) {
      throw new AppError("Invalid session. Please start over.", 400, "INVALID_RESET_SESSION");
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.passwordChangedAt = now();
    await userRepository.saveUser(user);
    await verificationTokenRepository.deleteTokensByUserId(user._id);

    return { message: "Password reset successfully. You can now login." };
  };

  return {
    sendForgotPasswordOtp,
    verifyResetOtp,
    resetPassword,
  };
};

module.exports = createForgotPasswordService;
