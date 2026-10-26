const db = require("../config/db");
const env = require("../config/env");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const IdempotencyKey = require("../models/IdempotencyKey");
const PlatformSetting = require("../models/PlatformSetting");
const createWalletRepository = require("../repositories/wallet.repository");
const createTransactionRepository = require("../repositories/transaction.repository");
const createIdempotencyRepository = require("../repositories/idempotency.repository");
const createPlatformSettingRepository = require("../repositories/platformSetting.repository");
const createWalletService = require("../services/wallet.service");
const createWalletController = require("../controllers/wallet.controller");
const createInternalWalletRouter = require("../routes/internalWallet.routes");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const createAuthenticate = require("../middleware/authenticate");
const createWalletRouter = require("../routes/wallet.routes");
const createEscrowService = require("../services/escrow.service");
const createEscrowController = require("../controllers/escrow.controller");
const createEscrowRouter = require("../routes/escrow.routes");
const createInternalSettingsController = require("../controllers/internalSettings.controller");
const createInternalSettingsRouter = require("../routes/internalSettings.routes");
const createInternalRefundController = require("../controllers/internalRefund.controller");
const createInternalRefundRouter = require("../routes/internalRefund.routes");
const createPlatformSettingsService = require("../services/platformSettings.service");
const escrowValidations = require("../middleware/escrowValidation");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createWorkspaceClient = require("../clients/workspaceClient");

const health = {
  isReady: () => db.isConnected(),
};

const walletRepository = createWalletRepository(Wallet);
const transactionRepository = createTransactionRepository(Transaction);
const idempotencyRepository = createIdempotencyRepository(IdempotencyKey);
const platformSettingRepository = createPlatformSettingRepository(PlatformSetting);
const platformSettingsService = createPlatformSettingsService({
  platformSettingRepository,
  defaultCommissionRate: env.commissionRate,
});

const walletService = createWalletService({
  walletRepository,
  transactionRepository,
  idempotencyRepository,
  runInTransaction: db.runInTransaction,
});

const walletController = createWalletController({ walletService });
const internalWalletRouter = createInternalWalletRouter({ walletController });
const authenticate = createAuthenticate({ accessSecret: env.jwtAccessSecret });
const walletRouter = createWalletRouter({ walletController, authenticate });
const workspaceHttpClient = createInternalHttpClient({
  baseUrl: env.workspaceServiceUrl,
  serviceToken: env.workspaceServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const workspaceClient = createWorkspaceClient({ httpClient: workspaceHttpClient });
const escrowService = createEscrowService({
  walletRepository,
  transactionRepository,
  workspaceClient,
  runInTransaction: db.runInTransaction,
  commissionRate: env.commissionRate,
  getCommissionRate: platformSettingsService.getCommissionRate,
});
const escrowController = createEscrowController({ escrowService });
const escrowRouter = createEscrowRouter({
  escrowController,
  authenticate,
  validations: escrowValidations,
});
const internalServiceAuth = createInternalServiceAuth({
  serviceToken: env.internalServiceToken,
});
const internalSettingsController = createInternalSettingsController({ platformSettingsService });
const internalSettingsRouter = createInternalSettingsRouter({ controller: internalSettingsController });
const internalRefundController = createInternalRefundController({ escrowService });
const internalRefundRouter = createInternalRefundRouter({ controller: internalRefundController });

module.exports = {
  health,
  walletService,
  walletController,
  internalWalletRouter,
  walletRouter,
  workspaceClient,
  escrowService,
  escrowController,
  escrowRouter,
  internalServiceAuth,
  internalSettingsRouter,
  internalRefundRouter,
  platformSettingsService,
  database: db,
};
