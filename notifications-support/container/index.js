const env = require("../config/env");
const db = require("../config/db");
const Notification = require("../models/Notification");
const SupportMessage = require("../models/SupportMessage");
const EmailDelivery = require("../models/EmailDelivery");
const {
  createAuthenticate,
  createOptionalAuthenticate,
} = require("../middleware/authenticate");
const createNotificationRepository = require("../repositories/notification.repository");
const createNotificationService = require("../services/notification.service");
const createNotificationController = require("../controllers/notification.controller");
const createNotificationRouter = require("../routes/notification.routes");
const notificationValidations = require("../middleware/notificationValidation");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const createInternalNotificationController = require("../controllers/internalNotification.controller");
const createInternalNotificationRouter = require("../routes/internalNotification.routes");
const internalNotificationValidation = require("../middleware/internalNotificationValidation");
const createAdminAuthenticate = require("../middleware/adminAuthenticate");
const createSupportMessageRepository = require("../repositories/supportMessage.repository");
const createSupportMessageService = require("../services/supportMessage.service");
const createSupportController = require("../controllers/support.controller");
const createSupportRouter = require("../routes/support.routes");
const supportValidations = require("../middleware/supportValidation");
const createAiGateway = require("../gateways/ai.gateway");
const createAiService = require("../services/ai.service");
const createAiController = require("../controllers/ai.controller");
const createAiRouter = require("../routes/ai.routes");
const aiValidation = require("../middleware/aiValidation");
const { createClient } = require("redis");
const createNotificationConsumer = require("../streams/notificationConsumer");
const createEmailDeliveryRepository = require("../repositories/emailDelivery.repository");
const createReportEmailService = require("../services/reportEmail.service");
const createInternalEmailController = require("../controllers/internalEmail.controller");
const createInternalEmailRouter = require("../routes/internalEmail.routes");
const { sendEmail } = require("../clients/smtpMailer");
const createWorkspaceClient = require("../clients/workspaceClient");
const createSessionReminderService = require("../services/sessionReminder.service");

const health = { isReady: () => db.isConnected() };
const notificationRepository = createNotificationRepository(Notification);
const notificationEventRedisClient = createClient({ url: env.redisUrl });
const notificationEventPublisher = {
  publish: async (event) => {
    if (!env.redisEnabled) return { delivered: false, skipped: true };
    if (!notificationEventRedisClient.isOpen)
      await notificationEventRedisClient.connect();
    await notificationEventRedisClient.xAdd(
      env.notificationEventsStreamName,
      "*",
      { payload: JSON.stringify(event) },
    );
    return { delivered: true };
  },
};
const notificationService = createNotificationService({
  notificationRepository,
  eventPublisher: notificationEventPublisher,
});
const workspaceClient = createWorkspaceClient({});
const sessionReminderService = createSessionReminderService({
  workspaceClient,
  notificationService,
});
const emailDeliveryRepository = createEmailDeliveryRepository(EmailDelivery);
const reportEmailService = createReportEmailService({
  sendEmail,
  emailDeliveryRepository,
});
const internalEmailController = createInternalEmailController({
  reportEmailService,
});
const internalEmailRouter = createInternalEmailRouter({
  controller: internalEmailController,
});
const notificationController = createNotificationController({
  notificationService,
});
const authenticate = createAuthenticate({ accessSecret: env.jwtAccessSecret });
const notificationRouter = createNotificationRouter({
  controller: notificationController,
  authenticate,
  validations: notificationValidations,
});
const internalServiceAuth = createInternalServiceAuth({
  serviceToken: env.workspaceServiceToken,
});
const internalNotificationController = createInternalNotificationController({
  notificationService,
});
const internalNotificationRouter = createInternalNotificationRouter({
  controller: internalNotificationController,
  validation: internalNotificationValidation,
});
const notificationRedisClient = createClient({ url: env.redisUrl });
const notificationConsumer = createNotificationConsumer({
  client: notificationRedisClient,
  streamName: env.notificationStreamName,
  groupName: env.notificationConsumerGroup,
  consumerName: env.notificationConsumerName,
  notificationService,
  workspaceClient,
  sessionReminderService,
  reportEmailService,
  internalEmailController,
  internalEmailRouter,
  emailDeliveryRepository,
  enabled: env.redisEnabled,
});
const supportMessageRepository = createSupportMessageRepository(SupportMessage);
const supportMessageService = createSupportMessageService({
  supportMessageRepository,
  notificationService,
});
const supportController = createSupportController({
  supportService: supportMessageService,
});
const optionalAuthenticate = createOptionalAuthenticate({
  accessSecret: env.jwtAccessSecret,
});
const adminAuthenticate = createAdminAuthenticate({
  accessSecret: env.jwtAccessSecret,
});
const supportRouter = createSupportRouter({
  controller: supportController,
  adminAuthenticate,
  optionalAuthenticate,
  validations: supportValidations,
});
const aiGateway = createAiGateway({
  apiKey: env.groqApiKey,
  endpoint: env.groqApiUrl,
  model: env.groqModel,
});
const aiService = createAiService({ aiGateway });
const aiController = createAiController({ aiService });
const aiRouter = createAiRouter({
  controller: aiController,
  authenticate,
  validation: aiValidation,
});

module.exports = {
  health,
  notificationRepository,
  notificationService,
  reportEmailService,
  notificationController,
  notificationRouter,
  internalServiceAuth,
  internalNotificationController,
  internalNotificationRouter,
  notificationConsumer,
  notificationEventRedisClient,
  supportMessageRepository,
  supportMessageService,
  supportController,
  supportRouter,
  aiGateway,
  aiService,
  aiController,
  aiRouter,
  database: db,
};
