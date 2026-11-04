const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_SESSION_DURATIONS = [30, 60];

const createAvailabilityRepository = (Availability) => {
  const findAvailabilityByMentor = (mentorId) =>
    Availability.findOne({ mentor: mentorId });

  const createAvailability = (data) =>
    Availability.create({
      mentor: data.mentorId,
      timezone: data.timezone || DEFAULT_TIMEZONE,
      sessionDurations: data.sessionDurations || DEFAULT_SESSION_DURATIONS,
      specificDates: data.specificDates || [],
      weeklyHours: data.weeklyHours,
    });

  const updateAvailability = (mentorId, updates) =>
    Availability.findOneAndUpdate(
      { mentor: mentorId },
      { $set: updates },
      { new: true, runValidators: true, upsert: true },
    );

  const deleteAvailability = (mentorId) =>
    Availability.findOneAndDelete({ mentor: mentorId });

  const updateGoogleCalendarConfig = (mentorId, updateData) =>
    Availability.findOneAndUpdate(
      { mentor: mentorId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true },
    );

  const findWithCalendarToken = (mentorId) =>
    Availability.findOne({ mentor: mentorId }).select("+googleCalendarToken");

  return {
    findAvailabilityByMentor,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    updateGoogleCalendarConfig,
    findWithCalendarToken,
  };
};

module.exports = createAvailabilityRepository;
