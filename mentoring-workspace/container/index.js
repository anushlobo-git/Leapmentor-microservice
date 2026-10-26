const env = require("../config/env");
const db = require("../config/db");
const ConnectRequest = require("../models/ConnectRequest");
const Report = require("../models/Report");
const SlotLock = require("../models/SlotLock");
const createAvailabilityBlockerRepository = require("../repositories/availabilityBlocker.repository");
const createInternalAvailabilityController = require("../controllers/internalAvailability.controller");
const createInternalAvailabilityRouter = require("../routes/internalAvailability.routes");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const createConnectRequestPaymentRepository = require("../repositories/connectRequestPayment.repository");
const createInternalPaymentController = require("../controllers/internalPayment.controller");
const createInternalPaymentRouter = require("../routes/internalPayment.routes");
const createInternalAdminUserController = require("../controllers/internalAdminUser.controller");
const createInternalAdminUserRouter = require("../routes/internalAdminUser.routes");
const createInternalAdminStatsController = require("../controllers/internalAdminStats.controller");
const createInternalAdminStatsRouter = require("../routes/internalAdminStats.routes");
const createReportRepository = require("../repositories/report.repository");
const createInternalAdminReportsController = require("../controllers/internalAdminReports.controller");
const createInternalAdminReportsRouter = require("../routes/internalAdminReports.routes");
const createAuthenticate = require("../middleware/authenticate");
const createConnectRequestRepository = require("../repositories/connectRequest.repository");
const createConnectRequestService = require("../services/connectRequest.service");
const createConnectRequestController = require("../controllers/connectRequest.controller");
const createConnectRequestRouter = require("../routes/connectRequest.routes");
const connectRequestValidations = require("../middleware/connectRequestValidation");
const createSlotLockRepository = require("../repositories/slotLock.repository");
const createSlotLockService = require("../services/slotLock.service");
const createSlotLockController = require("../controllers/slotLock.controller");
const createSlotLockRouter = require("../routes/slotLock.routes");
const slotLockValidations = require("../middleware/slotLockValidation");
const { toSlotLockDTO } = require("../utils/slotLock.mapper");
const createSessionRepository = require("../repositories/session.repository");
const createSessionService = require("../services/session.service");
const createSessionController = require("../controllers/session.controller");
const createSessionRouter = require("../routes/session.routes");
const sessionValidations = require("../middleware/sessionValidation");
const Message = require("../models/Message");
const createMessageRepository = require("../repositories/message.repository");
const createMessageService = require("../services/message.service");
const createMessageController = require("../controllers/message.controller");
const createMessageRouter = require("../routes/message.routes");
const messageValidations = require("../middleware/messageValidation");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createNotificationClient = require("../clients/notificationClient");
const { createClient } = require("redis");
const createNotificationStreamPublisher = require("../clients/notificationStream");
const createSocketAuth = require("../socket/socketAuth");
const createMessageSocketHandler = require("../socket/messageSocket");

const health = { isReady: () => db.isConnected() };
const connectRequestRepository = createConnectRequestRepository(ConnectRequest);
const availabilityBlockerRepository = createAvailabilityBlockerRepository({
  ConnectRequest,
  SlotLock,
});
const internalAvailabilityController = createInternalAvailabilityController({
  availabilityBlockerRepository,
});
const internalAvailabilityRouter = createInternalAvailabilityRouter({
  internalAvailabilityController,
});
const internalServiceAuth = createInternalServiceAuth({
  serviceToken: env.internalServiceToken,
});
const internalAdminUserController = createInternalAdminUserController({
  connectRequestRepository,
});
const internalAdminUserRouter = createInternalAdminUserRouter({
  controller: internalAdminUserController,
});
const internalAdminServiceAuth = createInternalServiceAuth({
  serviceToken: env.adminServiceToken,
});
const internalAdminStatsController = createInternalAdminStatsController({
  connectRequestRepository,
});
const internalAdminStatsRouter = createInternalAdminStatsRouter({
  controller: internalAdminStatsController,
});
const connectRequestPaymentRepository = createConnectRequestPaymentRepository(
  ConnectRequest,
);
const internalPaymentController = createInternalPaymentController({
  connectRequestPaymentRepository,
});
const internalPaymentRouter = createInternalPaymentRouter({
  internalPaymentController,
});
const notificationsHttpClient = createInternalHttpClient({
  baseUrl: env.notificationsServiceUrl,
  serviceToken: env.notificationsServiceToken,
  timeoutMs: env.internalRequestTimeoutMs,
});
const notificationRedisClient = createClient({ url: env.redisUrl });
const notificationStreamPublisher = createNotificationStreamPublisher({
  client: notificationRedisClient,
  streamName: env.notificationStreamName,
  enabled: env.redisEnabled,
});
const notificationClient = createNotificationClient({
  httpClient: notificationsHttpClient,
  serviceToken: env.notificationsServiceToken,
  streamPublisher: env.redisEnabled ? notificationStreamPublisher : null,
});
const reportRepository = createReportRepository(Report);
const internalAdminReportsController = createInternalAdminReportsController({
  reportRepository,
  connectRequestRepository,
  notificationClient,
});
const internalAdminReportsRouter = createInternalAdminReportsRouter({
  controller: internalAdminReportsController,
});
const connectRequestService = createConnectRequestService({ connectRequestRepository, notificationClient });
const connectRequestController = createConnectRequestController({ connectRequestService });
const authenticate = createAuthenticate({ accessSecret: env.jwtAccessSecret });
const connectRequestRouter = createConnectRequestRouter({
  controller: connectRequestController,
  authenticate,
  validations: connectRequestValidations,
});
const slotLockRepository = createSlotLockRepository(SlotLock);
const slotLockService = createSlotLockService({
  slotLockRepository,
  availabilityBlockerRepository,
  toSlotLockDTO,
});
const slotLockController = createSlotLockController({ slotLockService });
const slotLockRouter = createSlotLockRouter({
  controller: slotLockController,
  authenticate,
  validations: slotLockValidations,
});
const sessionRepository = createSessionRepository(ConnectRequest);
const sessionService = createSessionService({ sessionRepository, notificationClient });
const sessionController = createSessionController({ sessionService });
const sessionRouter = createSessionRouter({
  controller: sessionController,
  authenticate,
  validations: sessionValidations,
});
const messageRepository = createMessageRepository(Message);
const messageService = createMessageService({ messageRepository, connectRequestRepository });
const messageController = createMessageController({ messageService });
const messageRouter = createMessageRouter({ controller: messageController, authenticate, validations: messageValidations });
const socketAuth = createSocketAuth({ accessSecret: env.jwtAccessSecret });

module.exports = {
  health,
  availabilityBlockerRepository,
  internalAvailabilityController,
  internalAvailabilityRouter,
  internalServiceAuth,
  connectRequestPaymentRepository,
  internalPaymentController,
  internalPaymentRouter,
  internalAdminUserController,
  internalAdminUserRouter,
  internalAdminServiceAuth,
  internalAdminStatsController,
  internalAdminStatsRouter,
  reportRepository,
  internalAdminReportsController,
  internalAdminReportsRouter,
  connectRequestRepository,
  connectRequestService,
  connectRequestController,
  connectRequestRouter,
  slotLockRepository,
  slotLockService,
  slotLockController,
  slotLockRouter,
  sessionRepository,
  sessionService,
  sessionController,
  sessionRouter,
  messageRepository,
  messageService,
  messageController,
  messageRouter,
  notificationsHttpClient,
  notificationClient,
  notificationStreamPublisher,
  socketAuth,
  createMessageSocketHandler,
  database: db,
};
