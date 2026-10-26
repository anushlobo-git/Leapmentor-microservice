const env = require("../config/env");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const OAuthAccount = require("../models/OAuthAccount");
const createUserRepository = require("../repositories/user.repository");
const createVerificationTokenRepository = require("../repositories/verificationToken.repository");
const createOAuthAccountRepository = require("../repositories/oauthAccount.repository");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createPaymentsClient = require("../clients/paymentsClient");
const createTokenService = require("../utils/token.service");
const createAuthService = require("../services/auth.service");
const createUserService = require("../services/user.service");
const createSessionService = require("../services/session.service");
const createVerificationService = require("../services/verification.service");
const createForgotPasswordService = require("../services/forgotPassword.service");
const createFederatedAuthService = require("../services/federatedAuth.service");
const createGoogleAuthService = require("../services/googleAuth.service");
const createLinkedinAuthService = require("../services/linkedinAuth.service");
const createAuthController = require("../controllers/auth.controller");
const createRefreshController = require("../controllers/refresh.controller");
const createVerificationController = require("../controllers/verification.controller");
const createForgotPasswordController = require("../controllers/forgotPassword.controller");
const createUserController = require("../controllers/user.controller");
const createOAuthController = require("../controllers/oauth.controller");
const createInternalUserController = require("../controllers/internalUser.controller");
const createInternalAdminUserController = require("../controllers/internalAdminUser.controller");
const createAuthRouter = require("../routes/auth.routes");
const createOAuthPublicRouter = require("../routes/oauthPublic.routes");
const createInternalUserRouter = require("../routes/internalUser.routes");
const createInternalAdminUserRouter = require("../routes/internalAdminUser.routes");
const createInternalAdminStatsController = require("../controllers/internalAdminStats.controller");
const createInternalAdminStatsRouter = require("../routes/internalAdminStats.routes");
const createVerificationRouter = require("../routes/verification.routes");
const createForgotPasswordRouter = require("../routes/forgotPassword.routes");
const createUserRouter = require("../routes/user.routes");
const verificationValidations = require("../middleware/verificationValidation");
const forgotPasswordValidations = require("../middleware/forgotPasswordValidation");
const userValidations = require("../middleware/userValidation");
const createAuthenticate = require("../middleware/authenticate");
const { sendEmail } = require("../config/mailer");
const createCookieService = require("../utils/cookie.service");
const createOAuthStateService = require("../utils/oauthState.service");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");

const health = {
  isReady: () => db.isConnected(),
};

const paymentsHttpClient = createInternalHttpClient({
  baseUrl: env.paymentsServiceUrl,
  serviceToken: env.paymentsServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});

const paymentsClient = createPaymentsClient({
  httpClient: paymentsHttpClient,
});

const userRepository = createUserRepository(User);
const oauthAccountRepository = createOAuthAccountRepository(OAuthAccount);
const verificationTokenRepository = createVerificationTokenRepository(
  VerificationToken,
);
const tokenService = createTokenService({
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,
  accessExpiresIn: env.jwtAccessExpiresIn,
  refreshExpiresIn: env.jwtRefreshExpiresIn,
});
const authService = createAuthService({
  userRepository,
  paymentsClient,
  bcrypt,
  tokenService,
});
const userService = createUserService();
const federatedAuthService = createFederatedAuthService({
  userRepository,
  oauthAccountRepository,
  paymentsClient,
  tokenService,
});
const googleClient = new OAuth2Client(env.google.clientId || undefined);
const googleAuthService = createGoogleAuthService({
  federatedAuthService,
  googleClient,
  clientId: env.google.clientId,
});
const linkedinAuthService = createLinkedinAuthService({
  federatedAuthService,
  clientId: env.linkedin.clientId,
  clientSecret: env.linkedin.clientSecret,
  callbackUrl: env.linkedin.callbackUrl,
});
const sessionService = createSessionService({
  userRepository,
  tokenService,
});
const refreshController = createRefreshController({ sessionService });
const cookieService = createCookieService({
  isProduction: env.nodeEnv === "production",
});
const oauthStateService = createOAuthStateService({ secret: env.oauthStateSecret });
const oauthController = createOAuthController({
  googleAuthService,
  linkedinAuthService,
  federatedAuthService,
  cookieService,
  oauthStateService,
  clientId: env.linkedin.clientId,
  callbackUrl: env.linkedin.callbackUrl,
  clientUrl: env.clientUrl,
});
const authController = createAuthController({ authService, cookieService });
const authRouter = createAuthRouter({
  authController,
  refreshController,
  cookieService,
  oauthController,
  validations: require("../middleware/oauthValidation"),
  includePublicOAuth: false,
});
const oauthPublicRouter = createOAuthPublicRouter({ oauthController });
const internalUserController = createInternalUserController({
  userRepository,
  userService,
});
const internalUserRouter = createInternalUserRouter({ internalUserController });
const internalAdminUserController = createInternalAdminUserController({
  userRepository,
  userService,
});
const internalAdminUserRouter = createInternalAdminUserRouter({
  controller: internalAdminUserController,
});
const internalServiceAuth = createInternalServiceAuth({
  serviceToken: env.profileServiceToken,
});
const internalAdminServiceAuth = createInternalServiceAuth({
  serviceToken: env.adminServiceToken,
});
const internalAdminStatsController = createInternalAdminStatsController({
  userRepository,
});
const internalAdminStatsRouter = createInternalAdminStatsRouter({
  controller: internalAdminStatsController,
});
const verificationService = createVerificationService({
  userRepository,
  verificationTokenRepository,
  bcrypt,
  sendEmail,
  appBaseUrl: env.appBaseUrl,
  fromEmail: env.smtp.fromEmail,
});
const verificationController = createVerificationController({
  verificationService,
});
const verificationRouter = createVerificationRouter({
  verificationController,
  validations: verificationValidations,
});
const forgotPasswordService = createForgotPasswordService({
  userRepository,
  verificationTokenRepository,
  bcrypt,
  sendEmail,
  fromEmail: env.smtp.fromEmail,
});
const forgotPasswordController = createForgotPasswordController({
  forgotPasswordService,
});
const forgotPasswordRouter = createForgotPasswordRouter({
  forgotPasswordController,
  validations: forgotPasswordValidations,
});
const authenticate = createAuthenticate({ tokenService, userRepository });
const userController = createUserController({ authService, userService });
const userRouter = createUserRouter({
  userController,
  userService,
  authenticate,
  validations: userValidations,
});

module.exports = {
  health,
  paymentsClient,
  userRepository,
  authService,
  federatedAuthService,
  googleAuthService,
  linkedinAuthService,
  oauthController,
  oauthPublicRouter,
  internalUserController,
  internalUserRouter,
  internalServiceAuth,
  internalAdminUserController,
  internalAdminUserRouter,
  internalAdminServiceAuth,
  internalAdminStatsController,
  internalAdminStatsRouter,
  oauthAccountRepository,
  sessionService,
  refreshController,
  cookieService,
  authController,
  authRouter,
  verificationService,
  verificationController,
  verificationRouter,
  forgotPasswordService,
  forgotPasswordController,
  forgotPasswordRouter,
  authenticate,
  userController,
  userRouter,
  database: db,
};
