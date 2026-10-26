const AppError = require("../utils/AppError");
const { ALL_ROLES, isValidRole } = require("../constants/roles");
const { toUserDTO } = require("../utils/user.mapper");

const DEFAULT_ROLE = "mentee";
const ALLOWED_GENERIC_PROVIDERS = new Set(["linkedin", "apple"]);

const createFederatedAuthService = ({
  userRepository,
  oauthAccountRepository,
  paymentsClient,
  tokenService,
  logger = console,
}) => {
  const validateRoles = (roles) => {
    const candidateRoles = Array.isArray(roles) && roles.length ? roles : [DEFAULT_ROLE];
    const uniqueRoles = [...new Set(candidateRoles)];
    const invalidRole = uniqueRoles.find((role) => !isValidRole(role));

    if (invalidRole) {
      throw new AppError(
        `Invalid role "${invalidRole}". Use one or more of: ${ALL_ROLES.join(
          ", ",
        )}.`,
        400,
        "INVALID_ROLE",
      );
    }

    return uniqueRoles;
  };

  const provisionWallets = async (user, roles, correlationId) => {
    const normalizedRoles = [...new Set(roles)].sort();
    const idempotencyKey = `identity:wallet:${user._id.toString()}:${normalizedRoles.join(
      ",",
    )}`;

    await userRepository.updateWalletProvisioningStatus(
      user._id,
      "pending",
      null,
    );

    try {
      await paymentsClient.provisionWallet({
        userId: user._id.toString(),
        roles: normalizedRoles,
        idempotencyKey,
        correlationId,
      });

      return (
        (await userRepository.updateWalletProvisioningStatus(
          user._id,
          "complete",
          null,
        )) || { ...user, walletProvisioningStatus: "complete" }
      );
    } catch (error) {
      await userRepository.updateWalletProvisioningStatus(
        user._id,
        "failed",
        error.message,
      );
      logger.error?.("Federated wallet provisioning is pending", {
        userId: user._id.toString(),
        error: error.message,
        correlationId,
      });

      throw new AppError(
        "Account created, but wallet provisioning is pending. Please retry registration.",
        503,
        "WALLET_PROVISIONING_PENDING",
      );
    }
  };

  const issueSession = (user, isNewUser) => ({
    accessToken: tokenService.signAccessToken(user._id),
    refreshToken: tokenService.signRefreshToken(user._id),
    user: toUserDTO(user),
    isNewUser,
  });

  const authenticateFederatedUser = async (
    { provider, providerId, email, name, roles, termsAccepted, emailVerified },
    { correlationId } = {},
  ) => {
    if (!provider || !providerId) {
      throw new AppError(
        "provider and providerId are required for social authentication",
        400,
        "INVALID_SOCIAL_IDENTITY",
      );
    }

    const existingOAuth = await oauthAccountRepository.findOAuthAccountWithUser(
      provider,
      providerId,
    );
    if (existingOAuth?.user) {
      return issueSession(existingOAuth.user, false);
    }

    if (!email?.trim()) {
      throw new AppError(
        "email is required to create or link an account",
        400,
        "EMAIL_REQUIRED",
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await userRepository.findUserByEmail(normalizedEmail);
    let isNewUser = false;

    if (!user) {
      if (termsAccepted !== true) {
        throw new AppError(
          "You must accept the terms to continue",
          400,
          "TERMS_NOT_ACCEPTED",
        );
      }

      const uniqueRoles = validateRoles(roles);
      user = await userRepository.createUser({
        name: name?.trim() || "User",
        email: normalizedEmail,
        roles: uniqueRoles,
        isEmailVerified: emailVerified !== false,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        walletProvisioningStatus: "pending",
      });

      user = await provisionWallets(user, uniqueRoles, correlationId);
      isNewUser = true;
    }

    try {
      await oauthAccountRepository.createOAuthAccount({
        user: user._id,
        provider,
        providerId,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const mapped = await oauthAccountRepository.findOAuthAccountWithUser(
        provider,
        providerId,
      );
      if (mapped?.user) return issueSession(mapped.user, false);
      throw error;
    }

    logger.info?.("Federated identity authenticated", {
      provider,
      userId: user._id.toString(),
      isNewUser,
    });
    return issueSession(user, isNewUser);
  };

  const socialAuthUser = async (payload, options) => {
    if (!ALLOWED_GENERIC_PROVIDERS.has(payload.provider)) {
      throw new AppError(
        "Invalid authentication provider configuration",
        400,
        "INVALID_PROVIDER",
      );
    }
    return authenticateFederatedUser(payload, options);
  };

  return {
    authenticateFederatedUser,
    socialAuthUser,
  };
};

module.exports = createFederatedAuthService;
