const crypto = require("node:crypto");

const AppError = require("../utils/AppError");
const { toWalletDTO } = require("../utils/wallet.mapper");

const ROLE_MENTEE = "mentee";
const ROLE_MENTOR = "mentor";
const MENTEE_WELCOME_BONUS = 500;
const OPERATION = "wallet.provision";

const hashRequest = ({ userId, roles }) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify({ userId, roles }))
    .digest("hex");

const createWalletService = ({
  walletRepository,
  transactionRepository,
  idempotencyRepository,
  runInTransaction,
  logger = console,
}) => {
  const normalizeRoles = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new AppError("At least one role is required", 400, "INVALID_ROLES");
    }

    const uniqueRoles = [...new Set(roles)];
    const invalidRole = uniqueRoles.find(
      (role) => ![ROLE_MENTEE, ROLE_MENTOR].includes(role),
    );
    if (invalidRole) {
      throw new AppError(
        `Unsupported wallet role: ${invalidRole}`,
        400,
        "INVALID_ROLE",
      );
    }

    return uniqueRoles;
  };

  const createWalletForRole = async (userId, role, session) => {
    const existing = await walletRepository.findWalletByUserAndRole(
      userId,
      role,
      session,
    );
    if (existing) return existing;

    const startingBalance = role === ROLE_MENTEE ? MENTEE_WELCOME_BONUS : 0;
    const wallet = await walletRepository.createWallet(
      {
        user: userId,
        role,
        balance: startingBalance,
        escrow: 0,
      },
      session,
    );

    if (role === ROLE_MENTEE) {
      await transactionRepository.createTransaction(
        {
          user: userId,
          type: "credit",
          amount: MENTEE_WELCOME_BONUS,
          description: `Welcome bonus — ${MENTEE_WELCOME_BONUS} points to get started`,
          balanceAfter: MENTEE_WELCOME_BONUS,
        },
        session,
      );
    }

    logger.info?.("Wallet provisioned", { userId, role });
    return wallet;
  };

  const provisionWallets = async ({
    userId,
    roles,
    idempotencyKey,
  }) => {
    if (!userId) throw new AppError("userId is required", 400, "INVALID_USER");
    if (!idempotencyKey) {
      throw new AppError(
        "Idempotency-Key header is required",
        400,
        "MISSING_IDEMPOTENCY_KEY",
      );
    }

    const normalizedRoles = normalizeRoles(roles);
    const requestHash = hashRequest({ userId, roles: normalizedRoles });
    const existing = await idempotencyRepository.findByKey(idempotencyKey);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          "Idempotency key was already used for a different request",
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status === "succeeded") {
        return { created: false, response: existing.responseBody };
      }
      throw new AppError(
        "The same wallet provisioning request is already in progress",
        409,
        "PROVISIONING_IN_PROGRESS",
      );
    }

    try {
      await idempotencyRepository.createPending({
        key: idempotencyKey,
        operation: OPERATION,
        requestHash,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const racedRequest = await idempotencyRepository.findByKey(idempotencyKey);
      if (racedRequest?.status === "succeeded") {
        return { created: false, response: racedRequest.responseBody };
      }
      throw new AppError(
        "The same wallet provisioning request is already in progress",
        409,
        "PROVISIONING_IN_PROGRESS",
      );
    }

    try {
      const response = await runInTransaction(async (session) => {
        const wallets = [];
        for (const role of normalizedRoles) {
          const wallet = await createWalletForRole(userId, role, session);
          wallets.push(toWalletDTO(wallet));
        }

        const responseBody = {
          userId: userId.toString(),
          wallets,
          provisioningStatus: "complete",
        };

        await idempotencyRepository.markSucceeded(
          idempotencyKey,
          responseBody,
          session,
        );
        return responseBody;
      });

      return { created: true, response };
    } catch (error) {
      await idempotencyRepository.deletePending(idempotencyKey);
      throw error;
    }
  };

  const getMyWallet = async (userId) => {
    const wallet = await walletRepository.findWalletByUserAndRole(
      userId,
      ROLE_MENTEE,
    );
    if (!wallet) throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    return {
      balance: wallet.balance ?? 0,
      escrow: wallet.escrow ?? 0,
    };
  };

  return {
    provisionWallets,
    getMyWallet,
  };
};

module.exports = createWalletService;
