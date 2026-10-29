const env = require("../config/env");
const db = require("../config/db");
const ConnectRequest = require("../models/ConnectRequest");
const Report = require("../models/Report");
const SlotLock = require("../models/SlotLock");
const OutboxEvent = require("../models/OutboxEvent");
const Goal = require("../models/Goal");
const Milestone = require("../models/Milestone");
const createAvailabilityBlockerRepository = require("../repositories/availabilityBlocker.repository");
const createInternalAvailabilityController = require("../controllers/internalAvailability.controller");
const createInternalAvailabilityRouter = require("../routes/internalAvailability.routes");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const createConnectRequestPaymentRepository = require("../repositories/connectRequestPayment.repository");
const createInternalPaymentController = require("../controllers/internalPayment.controller");
const createInternalPaymentRouter = require("../routes/internalPayment.routes");
const createFinanceRepository = require("../repositories/finance.repository");
const createInternalFinanceController = require("../controllers/internalFinance.controller");
const createInternalFinanceRouter = require("../routes/internalFinance.routes");
const createInternalReminderController = require("../controllers/internalReminder.controller");
const createInternalReminderRouter = require("../routes/internalReminder.routes");
const createInternalAdminUserController = require("../controllers/internalAdminUser.controller");
const createInternalAdminUserRouter = require("../routes/internalAdminUser.routes");
const createInternalAdminStatsController = require("../controllers/internalAdminStats.controller");
const createInternalAdminStatsRouter = require("../routes/internalAdminStats.routes");
const createInternalAdminPaymentsController = require("../controllers/internalAdminPayments.controller");
const createInternalAdminPaymentsRouter = require("../routes/internalAdminPayments.routes");
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
const createRealtimePublisher = require("../socket/realtimePublisher");
const createNotificationRealtimeConsumer = require("../socket/notificationConsumer");
const createOutboxRepository = require("../repositories/outbox.repository");
const createGoalRepository = require("../repositories/goal.repository");
const createMilestoneRepository = require("../repositories/milestone.repository");
const createGoalService = require("../services/goal.service");
const createGoalController = require("../controllers/goal.controller");
const createGoalRouter = require("../routes/goal.routes");
const goalValidations = require("../middleware/goalValidation");
const PrivateNote = require("../models/PrivateNote");
const createPrivateNoteRepository = require("../repositories/privateNote.repository");
const createPrivateNoteService = require("../services/privateNote.service");
const createPrivateNoteController = require("../controllers/privateNote.controller");
const createPrivateNoteRouter = require("../routes/privateNote.routes");
const privateNoteValidations = require("../middleware/privateNoteValidation");
const streamifier = require("streamifier");
const {
  cloudinary,
  configured: cloudinaryConfigured,
} = require("../config/cloudinary");
const Note = require("../models/Note");
const createNoteRepository = require("../repositories/note.repository");
const createCloudinaryClient = require("../clients/cloudinaryClient");
const createIdentityClient = require("../clients/identityClient");
const createMentorRatingClient = require("../clients/mentorRatingClient");
const createProfileClient = require("../clients/profileClient");
const createPaymentsClient = require("../clients/paymentsClient");
const Feedback = require("../models/Feedback");
const createFeedbackRepository = require("../repositories/feedback.repository");
const createFeedbackService = require("../services/feedback.service");
const createFeedbackController = require("../controllers/feedback.controller");
const createFeedbackRouter = require("../routes/feedback.routes");
const feedbackValidations = require("../middleware/feedbackValidation");
const createReportService = require("../services/report.service");
const createReportController = require("../controllers/report.controller");
const createReportRouter = require("../routes/report.routes");
const reportValidations = require("../middleware/reportValidation");
const reportUpload = require("../middleware/reportUpload");
const createNoteService = require("../services/note.service");
const createNoteController = require("../controllers/note.controller");
const createNoteRouter = require("../routes/note.routes");
const noteValidations = require("../middleware/noteValidation");
const { createNoteUpload } = require("../middleware/noteUpload");
const { getFileType } = require("../utils/fileType");

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
const internalAdminPaymentsController = createInternalAdminPaymentsController({
  connectRequestRepository,
});
const internalAdminPaymentsRouter = createInternalAdminPaymentsRouter({
  controller: internalAdminPaymentsController,
});
const connectRequestPaymentRepository =
  createConnectRequestPaymentRepository(ConnectRequest);
const internalPaymentController = createInternalPaymentController({
  connectRequestPaymentRepository,
});
const internalPaymentRouter = createInternalPaymentRouter({
  internalPaymentController,
});
const financeRepository = createFinanceRepository(ConnectRequest);
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
const outboxRepository = createOutboxRepository(OutboxEvent);
const notificationClient = createNotificationClient({
  httpClient: notificationsHttpClient,
  serviceToken: env.notificationsServiceToken,
  streamPublisher: env.redisEnabled ? notificationStreamPublisher : null,
  outboxRepository,
});
const reportRepository = createReportRepository(Report);
const profileHttpClient = createInternalHttpClient({
  baseUrl: env.profileServiceUrl,
  serviceToken: env.profileServiceToken,
  timeoutMs: env.internalRequestTimeoutMs,
});
const profileClient = createProfileClient({ httpClient: profileHttpClient });
const paymentsHttpClient = createInternalHttpClient({
  baseUrl: env.paymentsServiceUrl,
  serviceToken: env.paymentsServiceToken,
  timeoutMs: env.internalRequestTimeoutMs,
});
const paymentsClient = createPaymentsClient({ httpClient: paymentsHttpClient });
const realtimePublisher = createRealtimePublisher();
const realtimeRedisClient = createClient({ url: env.redisUrl });
const notificationRealtimeConsumer = createNotificationRealtimeConsumer({
  client: realtimeRedisClient,
  streamName: env.notificationEventsStreamName,
  groupName: env.notificationEventsConsumerGroup,
  consumerName: env.notificationEventsConsumerName,
  realtimePublisher,
  enabled: env.redisEnabled,
});
const connectRequestService = createConnectRequestService({
  connectRequestRepository,
  notificationClient,
  profileClient,
  identityClient,
  realtimePublisher,
});
const connectRequestController = createConnectRequestController({
  connectRequestService,
});
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
const sessionService = createSessionService({
  sessionRepository,
  notificationClient,
  profileClient,
  paymentsClient,
  identityClient,
  realtimePublisher,
});
const sessionController = createSessionController({ sessionService });
const sessionRouter = createSessionRouter({
  controller: sessionController,
  authenticate,
  validations: sessionValidations,
});
const messageRepository = createMessageRepository(Message);
const messageService = createMessageService({
  messageRepository,
  connectRequestRepository,
});
const messageController = createMessageController({ messageService });
const messageRouter = createMessageRouter({
  controller: messageController,
  authenticate,
  validations: messageValidations,
});
const goalRepository = createGoalRepository(Goal);
const milestoneRepository = createMilestoneRepository(Milestone);
const goalService = createGoalService({
  connectRequestRepository,
  goalRepository,
  milestoneRepository,
  realtimePublisher,
  notificationRealtimeConsumer,
  realtimeRedisClient,
});

const goalController = createGoalController({ goalService });
const goalRouter = createGoalRouter({
  controller: goalController,
  authenticate,
  validations: goalValidations,
});
const privateNoteRepository = createPrivateNoteRepository(PrivateNote);
const privateNoteService = createPrivateNoteService({
  privateNoteRepository,
  connectRequestRepository,
});
const privateNoteController = createPrivateNoteController({
  privateNoteService,
});
const privateNoteRouter = createPrivateNoteRouter({
  controller: privateNoteController,
  authenticate,
  validations: privateNoteValidations,
});
const identityHttpClient = createInternalHttpClient({
  baseUrl: env.identityServiceUrl,
  serviceToken: env.identityServiceToken,
  timeoutMs: env.internalRequestTimeoutMs,
});
const identityClient = createIdentityClient({ httpClient: identityHttpClient });
const internalAdminReportsController = createInternalAdminReportsController({
  reportRepository,
  connectRequestRepository,
  notificationClient,
  identityClient,
});
const internalAdminReportsRouter = createInternalAdminReportsRouter({
  controller: internalAdminReportsController,
});
const internalReminderController = createInternalReminderController({
  connectRequestRepository,
  identityClient,
});
const internalReminderRouter = createInternalReminderRouter({
  controller: internalReminderController,
});
const internalFinanceController = createInternalFinanceController({
  financeRepository,
  identityClient,
  profileClient,
  notificationClient,
});
const internalFinanceRouter = createInternalFinanceRouter({
  controller: internalFinanceController,
});
const mentorRatingClient = createMentorRatingClient({
  httpClient: profileHttpClient,
});
const feedbackRepository = createFeedbackRepository(Feedback);
const feedbackService = createFeedbackService({
  feedbackRepository,
  connectRequestRepository,
  identityClient,
  profileClient,
  paymentsClient,
  mentorRatingClient,
});
const feedbackController = createFeedbackController({ feedbackService });
const feedbackRouter = createFeedbackRouter({
  controller: feedbackController,
  authenticate,
  validations: feedbackValidations,
});
const cloudinaryClient = createCloudinaryClient({
  cloudinary,
  streamifier,
  configured: cloudinaryConfigured,
});
const reportService = createReportService({
  reportRepository,
  connectRequestRepository,
  cloudinaryClient,
});
const reportController = createReportController({ reportService });
const reportRouter = createReportRouter({
  controller: reportController,
  authenticate,
  identityClient,
  upload: reportUpload,
  validations: reportValidations,
});
const noteRepository = createNoteRepository(Note);
const noteService = createNoteService({
  noteRepository,
  connectRequestRepository,
  cloudinaryClient,
  identityClient,
  getFileType,
});
const noteController = createNoteController({ noteService });
const noteRouter = createNoteRouter({
  controller: noteController,
  authenticate,
  upload: createNoteUpload(),
  validations: noteValidations,
});
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
  internalFinanceController,
  internalFinanceRouter,
  internalReminderController,
  internalReminderRouter,
  internalAdminUserController,
  internalAdminUserRouter,
  internalAdminServiceAuth,
  internalAdminStatsController,
  internalAdminStatsRouter,
  internalAdminPaymentsController,
  internalAdminPaymentsRouter,
  reportRepository,
  internalAdminReportsController,
  internalAdminReportsRouter,
  reportService,
  reportController,
  reportRouter,
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
  goalRepository,
  milestoneRepository,
  goalService,
  goalController,
  goalRouter,
  privateNoteRepository,
  privateNoteService,
  privateNoteController,
  privateNoteRouter,
  noteRepository,
  noteService,
  noteController,
  noteRouter,
  identityClient,
  feedbackRepository,
  feedbackService,
  feedbackController,
  feedbackRouter,
  cloudinaryClient,
  notificationsHttpClient,
  notificationClient,
  notificationStreamPublisher,
  outboxRepository,
  socketAuth,
  realtimePublisher,
  createMessageSocketHandler,
  database: db,
};
