const mongoose = require("mongoose");

const createInternalAdminProfileController = ({
  adminProfileRepository,
  toMentorProfileDTO,
  toMenteeProfileDTO,
}) => {
  const getProfiles = async (req, res, next) => {
    try {
      const userIds = String(req.query.ids || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (
        userIds.length === 0 ||
        userIds.some((id) => !mongoose.Types.ObjectId.isValid(id))
      ) {
        return res.status(400).json({
          error: "Valid user ids are required",
          code: "INVALID_PROFILE_USER_IDS",
        });
      }

      const { mentorProfiles, menteeProfiles } =
        await adminProfileRepository.findProfilesByUserIds(userIds);
      const profileByUserId = new Map();

      for (const profile of mentorProfiles) {
        profileByUserId.set(profile.user.toString(), toMentorProfileDTO(profile));
      }
      for (const profile of menteeProfiles) {
        if (!profileByUserId.has(profile.user.toString())) {
          profileByUserId.set(profile.user.toString(), toMenteeProfileDTO(profile));
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          profiles: userIds.map((userId) => ({
            userId,
            profile: profileByUserId.get(userId) || null,
          })),
        },
        message: "Profiles retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getProfiles };
};

module.exports = createInternalAdminProfileController;
