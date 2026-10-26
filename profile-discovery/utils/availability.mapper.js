const toAvailabilityDTO = (availability) => {
  if (!availability) return null;

  return {
    _id: availability._id?.toString?.() || availability._id || null,
    mentor: availability.mentor?.toString?.() || availability.mentor || "",
    timezone: availability.timezone || "Asia/Kolkata",
    sessionDurations: availability.sessionDurations || [],
    weeklyHours: availability.weeklyHours || [],
    specificDates: availability.specificDates || [],
    googleCalendarConnected: availability.googleCalendarConnected || false,
    createdAt: availability.createdAt || null,
    updatedAt: availability.updatedAt || null,
  };
};

module.exports = { toAvailabilityDTO };
