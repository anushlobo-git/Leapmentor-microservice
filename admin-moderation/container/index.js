const jwt = require("jsonwebtoken");

const env = require("../config/env");
const db = require("../config/db");
const AdminUser = require("../models/AdminUser");
const createAdminUserRepository = require("../repositories/adminUser.repository");
const createAdminAuthService = require("../services/auth.service");
const createAuthController = require("../controllers/auth.controller");
const createAuthRouter = require("../routes/auth.routes");
const createUserManagementService = require("../services/userManagement.service");
const createUserManagementController = require("../controllers/userManagement.controller");
const createUserManagementRouter = require("../routes/userManagement.routes");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createIdentityAdminClient = require("../clients/identityAdminClient");
const createProfileAdminClient = require("../clients/profileAdminClient");
const createWorkspaceAdminClient = require("../clients/workspaceAdminClient");
const createPaymentsAdminClient = require("../clients/paymentsAdminClient");
const createTtlCache = require("../utils/ttlCache");
const createDashboardService = require("../services/dashboard.service");
const createDashboardController = require("../controllers/dashboard.controller");
const createDashboardRouter = require("../routes/dashboard.routes");
const createSettingsService = require("../services/settings.service");
const createSettingsController = require("../controllers/settings.controller");
const createSettingsRouter = require("../routes/settings.routes");
const createVerificationService = require("../services/verification.service");
const createVerificationController = require("../controllers/verification.controller");
const createVerificationRouter = require("../routes/verification.routes");
const createReportsService = require("../services/reports.service");
const createReportsController = require("../controllers/reports.controller");
const createReportsRouter = require("../routes/reports.routes");
const createAdminAuthenticate = require("../middleware/adminAuthenticate");
const createRequireReady = require("../middleware/requireReady");
const { toAdminDTO } = require("../utils/admin.mapper");
const { validateLogin } = require("../middleware/authValidation");

const health = { isReady: () => db.isConnected() };
const adminUserRepository = createAdminUserRepository(AdminUser);
const authService = createAdminAuthService({
  adminUserRepository,
  jwt,
  toAdminDTO,
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,
  accessExpiresIn: env.adminAccessExpiresIn,
  refreshExpiresIn: env.adminRefreshExpiresIn,
});
const authenticate = createAdminAuthenticate({
  adminUserRepository,
  jwt,
  accessSecret: env.jwtAccessSecret,
  toAdminDTO,
});
const authController = createAuthController({ authService });
const authRouter = createAuthRouter({
  controller: authController,
  authenticate,
  validateLogin,
  requireReady: createRequireReady({ health }),
});
const identityHttpClient = createInternalHttpClient({
  baseUrl: env.identityServiceUrl,
  serviceToken: env.adminServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const profileHttpClient = createInternalHttpClient({
  baseUrl: env.profileServiceUrl,
  serviceToken: env.adminServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const workspaceHttpClient = createInternalHttpClient({
  baseUrl: env.workspaceServiceUrl,
  serviceToken: env.adminServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const paymentsHttpClient = createInternalHttpClient({
  baseUrl: env.paymentsServiceUrl,
  serviceToken: env.internalServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const identityClient = createIdentityAdminClient({ httpClient: identityHttpClient });
const profileClient = createProfileAdminClient({ httpClient: profileHttpClient });
const workspaceClient = createWorkspaceAdminClient({ httpClient: workspaceHttpClient });
const paymentsClient = createPaymentsAdminClient({ httpClient: paymentsHttpClient });
const userManagementService = createUserManagementService({
  identityClient,
  profileClient,
  workspaceClient,
});
const userManagementController = createUserManagementController({
  userManagementService,
});
const userManagementRouter = createUserManagementRouter({
  controller: userManagementController,
  authenticate,
  validateUsersQuery: require("../middleware/userValidation").validateUsersQuery,
  validateUserId: require("../middleware/userValidation").validateUserId,
});
const dashboardService = createDashboardService({
  identityClient,
  profileClient,
  workspaceClient,
  cache: createTtlCache(),
});
const dashboardController = createDashboardController({ dashboardService });
const dashboardRouter = createDashboardRouter({
  controller: dashboardController,
  authenticate,
});
const settingsService = createSettingsService({
  adminUserRepository,
  identityClient,
  workspaceClient,
  paymentsClient,
});
const settingsController = createSettingsController({ settingsService });
const settingsRouter = createSettingsRouter({
  controller: settingsController,
  authenticate,
  validation: require("../middleware/settingsValidation"),
});
const verificationService = createVerificationService({ profileClient });
const verificationController = createVerificationController({ verificationService });
const verificationRouter = createVerificationRouter({
  controller: verificationController,
  authenticate,
});
const reportsService = createReportsService({ workspaceClient, paymentsClient });
const reportsController = createReportsController({ reportsService });
const reportsRouter = createReportsRouter({
  controller: reportsController,
  authenticate,
});

module.exports = {
  health,
  database: db,
  adminUserRepository,
  authService,
  authController,
  authRouter,
  authenticate,
  identityClient,
  profileClient,
  workspaceClient,
  userManagementService,
  userManagementController,
  userManagementRouter,
  dashboardService,
  dashboardController,
  dashboardRouter,
  paymentsClient,
  settingsService,
  settingsController,
  settingsRouter,
  verificationService,
  verificationController,
  verificationRouter,
  reportsService,
  reportsController,
  reportsRouter,
};
