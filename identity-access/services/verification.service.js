const crypto = require("node:crypto");

const AppError = require("../utils/AppError");
const { ALL_ROLES } = require("../constants/roles");

const TOKEN_LIFETIME_MS = 10 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 10;

const createVerificationService = ({
  userRepository,
  verificationTokenRepository,
  bcrypt,
  sendEmail,
  appBaseUrl,
  fromEmail,
  now = () => new Date(),
  generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0"),
  generateToken = () => crypto.randomBytes(32).toString("hex"),
}) => {
  const sendVerificationEmail = async (user, subjectSuffix) => {
    await verificationTokenRepository.deleteTokensByUserId(user._id);

    const plainOtp = generateOtp();
    const plainToken = generateToken();
    const expiresAt = new Date(now().getTime() + TOKEN_LIFETIME_MS);
    const [hashedOtp, hashedToken] = await Promise.all([
      bcrypt.hash(plainOtp, BCRYPT_SALT_ROUNDS),
      bcrypt.hash(plainToken, BCRYPT_SALT_ROUNDS),
    ]);

    await verificationTokenRepository.createToken({
      user: user._id,
      otp: hashedOtp,
      token: hashedToken,
      expiresAt,
    });

    const magicLink = `${appBaseUrl}/verify-email?token=${encodeURIComponent(
      plainToken,
    )}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendEmail({
        from: fromEmail,
        to: user.email,
        subject: `LeapMentor Email Verification${subjectSuffix}`,
        text: [
          "Verify your LeapMentor account.",
          `Magic link: ${magicLink}`,
          `OTP: ${plainOtp}`,
          "Both expire in 10 minutes.",
        ].join("\n\n"),
        html: `<p>Verify your LeapMentor account.</p><p><a href="${magicLink}">Verify my email</a></p><p>OTP: <strong>${plainOtp}</strong></p><p>Both expire in 10 minutes.</p>`,
      });
    } catch (error) {
      await verificationTokenRepository.deleteTokensByUserId(user._id);
      throw new AppError(
        "Verification email could not be sent. Please try again later.",
        503,
        error.code || "EMAIL_DELIVERY_FAILED",
      );
    }
  };

  const findUser = async (rawEmail) => {
    if (!rawEmail) {
      throw new AppError("email is required", 400, "INVALID_EMAIL");
    }

    const email = String(rawEmail).toLowerCase().trim();
    const user = await userRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError("Account not found", 404, "USER_NOT_FOUND");
    }
    return user;
  };

  const initiateVerification = async (rawEmail, subjectSuffix = "") => {
    const user = await findUser(rawEmail);
    if (user.isEmailVerified) {
      throw new AppError(
        "Email is already verified",
        400,
        "EMAIL_ALREADY_VERIFIED",
      );
    }

    await sendVerificationEmail(user, subjectSuffix);
  };

  const verifyStoredValue = async ({ rawEmail, rawValue, field, expiredMessage }) => {
    if (!rawEmail || !rawValue) {
      throw new AppError(
        `Both email and ${field} are required`,
        400,
        "INVALID_VERIFICATION_INPUT",
      );
    }

    const user = await findUser(rawEmail);
    const tokenRecord = await verificationTokenRepository.findTokenByUserId(
      user._id,
    );
    if (!tokenRecord) {
      throw new AppError(
        "No active verification request found",
        400,
        "VERIFICATION_NOT_FOUND",
      );
    }

    if (tokenRecord.expiresAt < now()) {
      await verificationTokenRepository.deleteTokensByUserId(user._id);
      throw new AppError(expiredMessage, 400, "VERIFICATION_EXPIRED");
    }

    const matches = await bcrypt.compare(
      String(rawValue).trim(),
      tokenRecord[field],
    );
    if (!matches) {
      throw new AppError(
        "Invalid verification code",
        400,
        "INVALID_VERIFICATION_CODE",
      );
    }

    user.isEmailVerified = true;
    await userRepository.saveUser(user);
    await verificationTokenRepository.deleteTokensByUserId(user._id);
    return user;
  };

  const processOtpVerification = async (rawEmail, rawOtp) => {
    await verifyStoredValue({
      rawEmail,
      rawValue: rawOtp,
      field: "otp",
      expiredMessage: "The verification OTP has expired. Please request a new code.",
    });
  };

  const processLinkVerification = async (rawToken, rawEmail) => {
    const user = await verifyStoredValue({
      rawEmail,
      rawValue: rawToken,
      field: "token",
      expiredMessage: "The verification link has expired. Please request a new link.",
    });

    const role = Array.isArray(user.roles)
      ? ALL_ROLES.find((candidate) => user.roles.includes(candidate)) || user.roles[0] || null
      : null;
    return { role };
  };

  return {
    initiateVerification,
    processOtpVerification,
    processLinkVerification,
  };
};

module.exports = createVerificationService;
