const AppError = require("../utils/AppError");
const { ALL_ROLES, isValidRole } = require("../constants/roles");
const { toUserDTO } = require("../utils/user.mapper");

const BCRYPT_SALT_ROUNDS = 10;

const createAuthService = ({
  userRepository,
  paymentsClient,
  bcrypt,
  tokenService,
  logger = console,
}) => {
  const validateRoles = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new AppError(
        `At least one role is required. Use one or more of: ${ALL_ROLES.join(
          ", ",
        )}.`,
        400,
        "INVALID_ROLES",
      );
    }

    const uniqueRoles = [...new Set(roles)];
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

      const updatedUser = await userRepository.updateWalletProvisioningStatus(
        user._id,
        "complete",
        null,
      );
      return updatedUser || { ...user, walletProvisioningStatus: "complete" };
    } catch (error) {
      await userRepository.updateWalletProvisioningStatus(
        user._id,
        "failed",
        error.message,
      );
      logger.error?.("Wallet provisioning is pending", {
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

  const sessionFor = (outcome, user, normalizedEmail) => {
    if (!user.isEmailVerified) {
      return {
        outcome,
        isNewUser: false,
        loggedIn: false,
        email: normalizedEmail,
        user: toUserDTO(user),
      };
    }

    return {
      outcome,
      isNewUser: false,
      loggedIn: true,
      accessToken: tokenService.signAccessToken(user._id),
      refreshToken: tokenService.signRefreshToken(user._id),
      user: toUserDTO(user),
    };
  };

  const registerUser = async (
    { name, email, password, roles, termsAccepted },
    { correlationId } = {},
  ) => {
    if (!name?.trim()) throw new AppError("name is required", 400, "INVALID_NAME");
    if (!email?.trim()) {
      throw new AppError("email is required", 400, "INVALID_EMAIL");
    }
    if (!password || password.length < 8) {
      throw new AppError(
        "password must be at least 8 characters",
        400,
        "INVALID_PASSWORD",
      );
    }
    if (termsAccepted !== true) {
      throw new AppError("TERMS_NOT_ACCEPTED", 400, "TERMS_NOT_ACCEPTED");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const uniqueRoles = validateRoles(roles);
    const existing = await userRepository.findUserByEmailWithPassword(
      normalizedEmail,
    );

    if (existing) {
      const ownsAccount =
        !!existing.password && (await bcrypt.compare(password, existing.password));

      if (!ownsAccount) {
        return {
          outcome: "login_required",
          isNewUser: false,
          loggedIn: false,
          email: normalizedEmail,
        };
      }

      const missingRoles = uniqueRoles.filter(
        (role) => !existing.roles?.includes(role),
      );
      const requestedRoles = [...new Set([...(existing.roles || []), ...uniqueRoles])];

      if (missingRoles.length === 0) {
        if (existing.walletProvisioningStatus !== "complete") {
          const updatedUser = await provisionWallets(
            existing,
            requestedRoles,
            correlationId,
          );
          return sessionFor("already_registered", updatedUser, normalizedEmail);
        }
        return sessionFor("already_registered", existing, normalizedEmail);
      }

      let updatedUser = await userRepository.addRoleToUser(
        existing._id,
        missingRoles[0],
      );
      if (!updatedUser) {
        throw new AppError("Account not found", 404, "USER_NOT_FOUND");
      }

      updatedUser = await provisionWallets(
        updatedUser,
        requestedRoles,
        correlationId,
      );
      return sessionFor("role_added", updatedUser, normalizedEmail);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await userRepository.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      roles: uniqueRoles,
      isEmailVerified: false,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      walletProvisioningStatus: "pending",
    });

    const provisionedUser = await provisionWallets(
      user,
      uniqueRoles,
      correlationId,
    );

    return {
      outcome: "created",
      isNewUser: true,
      loggedIn: false,
      accessToken: tokenService.signAccessToken(provisionedUser._id),
      refreshToken: tokenService.signRefreshToken(provisionedUser._id),
      user: toUserDTO(provisionedUser),
    };
  };

  const loginUser = async ({ email, password }) => {
    if (!email?.trim() || !password) {
      throw new AppError(
        "Invalid email or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await userRepository.findUserByEmailWithPassword(
      normalizedEmail,
    );

    if (!user?.password) {
      throw new AppError(
        "Invalid email or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new AppError(
        "Invalid email or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (!user.isEmailVerified) {
      const error = new AppError(
        "Please verify your email address to log in.",
        403,
        "EMAIL_NOT_VERIFIED",
      );
      error.isEmailVerified = false;
      error.email = normalizedEmail;
      throw error;
    }

    return {
      accessToken: tokenService.signAccessToken(user._id),
      refreshToken: tokenService.signRefreshToken(user._id),
      user: toUserDTO(user),
      isNewUser: false,
    };
  };

  const addAccountRole = async (
    currentUser,
    role,
    { correlationId } = {},
  ) => {
    if (!isValidRole(role)) {
      throw new AppError(
        `Invalid role "${role}". Use one or more of: ${ALL_ROLES.join(", ")}.`,
        400,
        "INVALID_ROLE",
      );
    }

    const existingRoles = currentUser.roles || [];
    if (existingRoles.includes(role)) {
      if (currentUser.walletProvisioningStatus === "failed") {
        const recoveredUser = await provisionWallets(
          currentUser,
          existingRoles,
          correlationId,
        );
        return toUserDTO(recoveredUser);
      }
      throw new AppError(
        `Your account already has the "${role}" role.`,
        409,
        "ROLE_ALREADY_EXISTS",
      );
    }

    const updatedUser = await userRepository.addRoleToUser(
      currentUser._id,
      role,
    );
    if (!updatedUser) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }

    const provisionedUser = await provisionWallets(
      updatedUser,
      [...new Set([...existingRoles, role])],
      correlationId,
    );
    return toUserDTO(provisionedUser);
  };

  return {
    registerUser,
    loginUser,
    addAccountRole,
  };
};

module.exports = createAuthService;
