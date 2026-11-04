const AppError = require("../utils/AppError");

const createGoogleAuthService = ({
  federatedAuthService,
  googleClient,
  clientId,
}) => {
  const googleAuthUser = async (payload, options) => {
    if (!payload?.credential) {
      throw new AppError(
        "Missing Google credential",
        400,
        "GOOGLE_CREDENTIAL_REQUIRED",
      );
    }
    if (!clientId?.trim()) {
      throw new AppError(
        "Google authentication is not configured",
        503,
        "GOOGLE_NOT_CONFIGURED",
      );
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: payload.credential,
        audience: clientId,
      });
    } catch (error) {
      throw new AppError(
        `Google identity verification failed: ${error.message}`,
        401,
        "GOOGLE_CREDENTIAL_INVALID",
      );
    }

    const profile = ticket?.getPayload?.();
    if (!profile?.sub || !profile.email) {
      throw new AppError(
        "Invalid Google profile payload",
        400,
        "GOOGLE_PROFILE_INVALID",
      );
    }

    return federatedAuthService.authenticateFederatedUser(
      {
        provider: "google",
        providerId: profile.sub,
        email: profile.email,
        name: profile.name || "User",
        roles: payload.roles,
        termsAccepted: payload.termsAccepted,
        emailVerified: profile.email_verified,
      },
      options,
    );
  };

  return { googleAuthUser };
};

module.exports = createGoogleAuthService;
