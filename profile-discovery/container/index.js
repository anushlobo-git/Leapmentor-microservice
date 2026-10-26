const env = require("../config/env");
const db = require("../config/db");
const MentorProfile = require("../models/MentorProfile");
const MenteeProfile = require("../models/MenteeProfile");
const Availability = require("../models/Availability");
const createMentorProfileRepository = require("../repositories/mentorProfile.repository");
const createMenteeProfileRepository = require("../repositories/menteeProfile.repository");
const createAvailabilityRepository = require("../repositories/availability.repository");
const createMentorProfileService = require("../services/mentorProfile.service");
const createMenteeProfileService = require("../services/menteeProfile.service");
const createAvailabilityService = require("../services/availability.service");
const createMentorSearchRepository = require("../repositories/mentorSearch.repository");
const createMentorSearchService = require("../services/mentorSearch.service");
const createUploadService = require("../services/upload.service");
const createGoogleCalendarService = require("../services/googleCalendar.service");
const createMentorProfileController = require("../controllers/mentorProfile.controller");
const createMenteeProfileController = require("../controllers/menteeProfile.controller");
const createAvailabilityController = require("../controllers/availability.controller");
const createMentorSearchController = require("../controllers/mentorSearch.controller");
const createUploadController = require("../controllers/upload.controller");
const createGoogleCalendarController = require("../controllers/googleCalendar.controller");
const createMentorProfileRouter = require("../routes/mentorProfile.routes");
const createMenteeProfileRouter = require("../routes/menteeProfile.routes");
const createAvailabilityRouter = require("../routes/availability.routes");
const createMentorSearchRouter = require("../routes/mentorSearch.routes");
const createUploadRouter = require("../routes/upload.routes");
const createGoogleCalendarRouter = require("../routes/googleCalendar.routes");
const createAdminProfileRepository = require("../repositories/adminProfile.repository");
const createInternalAdminProfileController = require("../controllers/internalAdminProfile.controller");
const createInternalAdminProfileRouter = require("../routes/internalAdminProfile.routes");
const createInternalAdminStatsController = require("../controllers/internalAdminStats.controller");
const createInternalAdminStatsRouter = require("../routes/internalAdminStats.routes");
const createInternalAdminVerificationController = require("../controllers/internalAdminVerification.controller");
const createInternalAdminVerificationRouter = require("../routes/internalAdminVerification.routes");
const createInternalHttpClient = require("../clients/internalHttpClient");
const createIdentityClient = require("../clients/identityClient");
const createWorkspaceClient = require("../clients/workspaceClient");
const createAvailabilityHttpClient = require("../clients/internalHttpClient");
const createTokenService = require("../utils/token.service");
const createRequireReady = require("../middleware/requireReady");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const { toMentorProfileDTO } = require("../utils/mentorProfile.mapper");
const { toMenteeProfileDTO } = require("../utils/menteeProfile.mapper");
const {
  createAuthenticate,
  createRoleGuard,
} = require("../middleware/authenticate");
const validations = require("../middleware/mentorProfileValidation");
const menteeValidations = require("../middleware/menteeProfileValidation");
const availabilityValidations = require("../middleware/availabilityValidation");
const mentorSearchValidations = require("../middleware/mentorSearchValidation");
const uploadMiddleware = require("../middleware/upload.middleware");
const uploadValidations = require("../middleware/uploadValidation");
const googleCalendarValidations = require("../middleware/googleCalendarValidation");
const { cloudinary, configured: cloudinaryConfigured } = require("../config/cloudinary");
const streamifier = require("streamifier");
const { google } = require("googleapis");
const createCalendarStateService = require("../utils/calendarState.service");

const health = { isReady: () => db.isConnected() };

const identityHttpClient = createInternalHttpClient({
  baseUrl: env.identityServiceUrl,
  serviceToken: env.profileServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const identityClient = createIdentityClient({ httpClient: identityHttpClient });
const workspaceHttpClient = createAvailabilityHttpClient({
  baseUrl: env.workspaceServiceUrl,
  serviceToken: env.workspaceServiceToken,
  timeoutMs: env.internalHttpTimeoutMs,
});
const workspaceClient = createWorkspaceClient({ httpClient: workspaceHttpClient });
const tokenService = createTokenService({ accessSecret: env.jwtAccessSecret });
const mentorProfileRepository = createMentorProfileRepository(MentorProfile);
const mentorProfileService = createMentorProfileService({
  mentorProfileRepository,
  identityClient,
  toMentorProfileDTO,
});
const mentorProfileController = createMentorProfileController({
  mentorProfileService,
});
const authenticate = createAuthenticate({ tokenService, identityClient });
const mentorProfileRouter = createMentorProfileRouter({
  mentorProfileController,
  authenticate,
  requireRole: createRoleGuard,
  validations,
});
const menteeProfileRepository = createMenteeProfileRepository(MenteeProfile);
const menteeProfileService = createMenteeProfileService({
  menteeProfileRepository,
  identityClient,
  toMenteeProfileDTO,
});
const menteeProfileController = createMenteeProfileController({
  menteeProfileService,
});
const menteeProfileRouter = createMenteeProfileRouter({
  menteeProfileController,
  authenticate,
  requireRole: createRoleGuard,
  validations: menteeValidations,
});
const availabilityRepository = createAvailabilityRepository(Availability);
const availabilityService = createAvailabilityService({
  availabilityRepository,
  workspaceClient,
  toAvailabilityDTO: require("../utils/availability.mapper").toAvailabilityDTO,
});
const availabilityController = createAvailabilityController({ availabilityService });
const availabilityRouter = createAvailabilityRouter({
  availabilityController,
  authenticate,
  requireRole: createRoleGuard,
  validations: availabilityValidations,
});
const mentorSearchRepository = createMentorSearchRepository(MentorProfile);
const mentorSearchService = createMentorSearchService({
  mentorSearchRepository,
  identityClient,
  toMentorSearchDTO: require("../utils/mentorSearch.mapper").toMentorSearchDTO,
});
const mentorSearchController = createMentorSearchController({ mentorSearchService });
const mentorSearchRouter = createMentorSearchRouter({
  mentorSearchController,
  authenticate,
  requireRole: createRoleGuard,
  validations: mentorSearchValidations,
});
const uploadService = createUploadService({
  cloudinary,
  cloudinaryConfigured,
  streamifier,
  mentorProfileRepository,
  toMentorProfileDTO,
});
const uploadController = createUploadController({ uploadService });
const uploadRouter = createUploadRouter({
  uploadController,
  authenticate,
  requireRole: createRoleGuard,
  uploadMiddleware,
  validations: uploadValidations,
});
const calendarStateService = createCalendarStateService({
  secret: env.googleCalendar.stateSecret,
});
const googleCalendarService = createGoogleCalendarService({
  google,
  googleConfig: env.googleCalendar,
  calendarStateService,
  availabilityRepository,
});
const googleCalendarController = createGoogleCalendarController({
  googleCalendarService,
});
const googleCalendarRouter = createGoogleCalendarRouter({
  googleCalendarController,
  authenticate,
  requireRole: createRoleGuard,
  requireReady: createRequireReady({ health }),
  validations: googleCalendarValidations,
});
const adminProfileRepository = createAdminProfileRepository({
  MentorProfile,
  MenteeProfile,
});
const internalAdminProfileController = createInternalAdminProfileController({
  adminProfileRepository,
  toMentorProfileDTO,
  toMenteeProfileDTO,
});
const internalAdminProfileRouter = createInternalAdminProfileRouter({
  controller: internalAdminProfileController,
});
const internalAdminServiceAuth = createInternalServiceAuth({
  serviceToken: env.adminServiceToken,
});
const internalAdminStatsController = createInternalAdminStatsController({
  adminProfileRepository,
});
const internalAdminStatsRouter = createInternalAdminStatsRouter({
  controller: internalAdminStatsController,
});
const internalAdminVerificationController = createInternalAdminVerificationController({
  mentorProfileRepository,
  identityClient,
  toMentorProfileDTO,
});
const internalAdminVerificationRouter = createInternalAdminVerificationRouter({
  controller: internalAdminVerificationController,
});

module.exports = {
  health,
  mentorProfileRepository,
  mentorProfileService,
  mentorProfileController,
  mentorProfileRouter,
  menteeProfileRepository,
  menteeProfileService,
  menteeProfileController,
  menteeProfileRouter,
  availabilityRepository,
  availabilityService,
  availabilityController,
  availabilityRouter,
  mentorSearchRepository,
  mentorSearchService,
  mentorSearchController,
  mentorSearchRouter,
  uploadService,
  uploadController,
  uploadRouter,
  googleCalendarService,
  googleCalendarController,
  googleCalendarRouter,
  internalAdminProfileController,
  internalAdminProfileRouter,
  internalAdminServiceAuth,
  internalAdminStatsController,
  internalAdminStatsRouter,
  internalAdminVerificationController,
  internalAdminVerificationRouter,
  workspaceClient,
  identityClient,
  database: db,
};
