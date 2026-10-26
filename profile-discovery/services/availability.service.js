const AppError = require("../utils/AppError");
const { generateAvailableSlots } = require("../utils/generateSlots");

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_DURATIONS = [30, 60];
const ALLOWED_DURATIONS = new Set([30, 45, 60]);
const ALLOWED_UPDATE_FIELDS = [
  "timezone",
  "sessionDurations",
  "weeklyHours",
  "specificDates",
  "googleCalendarConnected",
];

const createAvailabilityService = ({
  availabilityRepository,
  workspaceClient,
  toAvailabilityDTO,
}) => {
  const requireMentor = (user) => {
    if (!user?.roles?.includes("mentor")) {
      throw new AppError("Access denied: mentor role required", 403, "ROLE_REQUIRED");
    }
  };

  const getMyAvailability = async (mentorId, { user } = {}) => {
    requireMentor(user);
    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);
    if (!availability) {
      return {
        mentor: mentorId,
        timezone: DEFAULT_TIMEZONE,
        sessionDurations: DEFAULT_DURATIONS,
        weeklyHours: [],
        specificDates: [],
        googleCalendarConnected: false,
        isNew: true,
      };
    }
    return toAvailabilityDTO(availability);
  };

  const createAvailability = async (mentorId, body, { user } = {}) => {
    requireMentor(user);
    const existing = await availabilityRepository.findAvailabilityByMentor(mentorId);
    if (existing) {
      throw new AppError(
        "Availability already exists. Use PATCH /api/v1/availability/me to update.",
        409,
        "AVAILABILITY_EXISTS",
      );
    }

    const availability = await availabilityRepository.createAvailability({
      mentorId,
      timezone: body.timezone,
      sessionDurations: body.sessionDurations,
      specificDates: body.specificDates,
      weeklyHours: body.weeklyHours,
    });
    return toAvailabilityDTO(availability);
  };

  const updateAvailability = async (mentorId, body, { user } = {}) => {
    requireMentor(user);
    const updates = Object.fromEntries(
      ALLOWED_UPDATE_FIELDS.filter((field) => Object.hasOwn(body || {}, field)).map(
        (field) => [field, body[field]],
      ),
    );
    if (Object.keys(updates).length === 0) {
      throw new AppError("No valid fields provided to update", 400, "INVALID_UPDATE");
    }
    const availability = await availabilityRepository.updateAvailability(mentorId, updates);
    return toAvailabilityDTO(availability);
  };

  const getMentorAvailability = async (mentorId) => {
    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);
    if (!availability) {
      throw new AppError("Availability not set by this mentor", 404, "AVAILABILITY_NOT_FOUND");
    }
    return {
      timezone: availability.timezone,
      sessionDurations: availability.sessionDurations,
      specificDates: availability.specificDates,
    };
  };

  const deleteAvailability = async (mentorId, { user } = {}) => {
    requireMentor(user);
    await availabilityRepository.deleteAvailability(mentorId);
  };

  const getAvailableSlots = async (
    mentorId,
    duration,
    userId,
    { correlationId } = {},
  ) => {
    if (!ALLOWED_DURATIONS.has(duration)) {
      throw new AppError("Duration must be 30, 45, or 60 minutes", 400, "INVALID_DURATION");
    }

    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);
    if (!availability) {
      throw new AppError("Availability not set by this mentor", 404, "AVAILABILITY_NOT_FOUND");
    }

    const blockers = await workspaceClient.getSlotBlockers(
      mentorId,
      userId,
      correlationId,
    );
    const bookedSlots = blockers?.bookedSlots || [];
    const lockedSlots = blockers?.lockedSlots || [];
    const slots = generateAvailableSlots(
      duration,
      availability.specificDates || [],
      availability.weeklyHours || [],
      [...bookedSlots, ...lockedSlots],
      28,
    );

    return {
      timezone: availability.timezone,
      sessionDurations: availability.sessionDurations,
      slots,
    };
  };

  return {
    getMyAvailability,
    createAvailability,
    updateAvailability,
    getMentorAvailability,
    deleteAvailability,
    getAvailableSlots,
  };
};

module.exports = createAvailabilityService;
