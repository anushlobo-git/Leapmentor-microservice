const db = require("../config/db");
const env = require("../config/env");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const IdempotencyKey = require("../models/IdempotencyKey");
const PlatformSetting = require("../models/PlatformSetting");
const LeapRequest = require("../models/LeapRequest");
const createWalletRepository = require("../repositories/wallet.repository");
const createTransactionRepository = require("../repositories/transaction.repository");
const createIdempotencyRepository = require("../repositories/idempotency.repository");
const createPlatformSettingRepository = require("../repositories/platformSetting.repository");
const createLeapRequestRepository = require("../repositories/leapRequest.repository");
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
const createInternalEscrowController = require("../controllers/internalEscrow.controller");
const createInternalEscrowRouter = require("../routes/internalEscrow.routes");
const internalEscrowValidation = require("../middleware/internalEscrowValidation");
const createPlatformSettingsService = require("../services/platformSettings.service");
const escrowValidations = require("../middleware/escrowValidation");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createWorkspaceClient = require("../clients/workspaceClient");
const createLeapRequestService = require("../services/leapRequest.service");
const createLeapRequestController = require("../controllers/leapRequest.controller");
const createLeapRequestRouter = require("../routes/leapRequest.routes");
const createInternalLeapRequestRouter = require("../routes/internalLeapRequest.routes");
const createInvoiceService = require("../services/invoice.service");
const createInvoiceController = require("../controllers/invoice.controller");
const createInvoiceRouter = require("../routes/invoice.routes");
const generateInvoice = require("../utils/generateInvoice");
const createEarningsService = require("../services/earnings.service");
const createEarningsController = require("../controllers/earnings.controller");
const createEarningsRouter = require("../routes/earnings.routes");
const createInternalAdminPaymentsController = require("../controllers/internalAdminPayments.controller");
const createInternalAdminPaymentsRouter = require("../routes/internalAdminPayments.routes");

const health = {
  isReady: () => db.isConnected(),
};

const walletRepository = createWalletRepository(Wallet);
const transactionRepository = createTransactionRepository(Transaction);
const idempotencyRepository = createIdempotencyRepository(IdempotencyKey);
const platformSettingRepository =
  createPlatformSettingRepository(PlatformSetting);
const leapRequestRepository = createLeapRequestRepository(LeapRequest);
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
const leapRequestService = createLeapRequestService({
  leapRequestRepository,
  walletRepository,
  transactionRepository,
  runInTransaction: db.runInTransaction,
});
const leapRequestController = createLeapRequestController({
  leapRequestService,
});
const leapRequestRouter = createLeapRequestRouter({
  controller: leapRequestController,
  authenticate,
});
const internalLeapRequestRouter = createInternalLeapRequestRouter({
  controller: leapRequestController,
});
const workspaceHttpClient = createInternalHttpClient({
  baseUrl: env.workspaceServiceUrl,
  serviceToken: env.workspaceServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const workspaceClient = createWorkspaceClient({
  httpClient: workspaceHttpClient,
});
const invoiceService = createInvoiceService({
  workspaceClient,
  getCommissionRate: platformSettingsService.getCommissionRate,
  generateInvoice,
});
const invoiceController = createInvoiceController({ invoiceService });
const invoiceRouter = createInvoiceRouter({
  controller: invoiceController,
  authenticate,
});
const earningsService = createEarningsService({
  workspaceClient,
  walletRepository,
  transactionRepository,
  idempotencyRepository,
  runInTransaction: db.runInTransaction,
});
const earningsController = createEarningsController({ earningsService });
const earningsRouter = createEarningsRouter({
  controller: earningsController,
  authenticate,
});
const escrowService = createEscrowService({
  walletRepository,
  transactionRepository,
  workspaceClient,
  runInTransaction: db.runInTransaction,
  commissionRate: env.commissionRate,
  getCommissionRate: platformSettingsService.getCommissionRate,
  generateInvoice,
});
const escrowController = createEscrowController({
  escrowService,
  getCommissionRate: platformSettingsService.getCommissionRate,
});
const escrowRouter = createEscrowRouter({
  escrowController,
  authenticate,
  validations: escrowValidations,
});
const internalServiceAuth = createInternalServiceAuth({
  serviceToken: env.internalServiceToken,
});
const internalSettingsController = createInternalSettingsController({
  platformSettingsService,
});
const internalSettingsRouter = createInternalSettingsRouter({
  controller: internalSettingsController,
});
const internalAdminPaymentsController = createInternalAdminPaymentsController({
  walletRepository,
  platformSettingsService,
  transactionRepository,
});
const internalAdminPaymentsRouter = createInternalAdminPaymentsRouter({
  controller: internalAdminPaymentsController,
});
const internalRefundController = createInternalRefundController({
  escrowService,
});
const internalRefundRouter = createInternalRefundRouter({
  controller: internalRefundController,
});
const internalEscrowController = createInternalEscrowController({
  escrowService,
});
const internalEscrowRouter = createInternalEscrowRouter({
  controller: internalEscrowController,
  validate: internalEscrowValidation,
});

module.exports = {
  health,
  walletService,
  walletController,
  internalWalletRouter,
  walletRouter,
  invoiceService,
  invoiceController,
  invoiceRouter,
  earningsService,
  earningsController,
  earningsRouter,
  leapRequestRepository,
  leapRequestService,
  leapRequestController,
  leapRequestRouter,
  internalLeapRequestRouter,
  workspaceClient,
  escrowService,
  escrowController,
  escrowRouter,
  internalServiceAuth,
  internalSettingsRouter,
  internalAdminPaymentsController,
  internalAdminPaymentsRouter,
  internalRefundRouter,
  internalEscrowRouter,
  platformSettingsService,
  database: db,
};
