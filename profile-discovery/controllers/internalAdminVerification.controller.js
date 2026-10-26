const mongoose = require("mongoose");

const createInternalAdminVerificationController = ({
  mentorProfileRepository,
  identityClient,
  toMentorProfileDTO,
}) => {
  const requireId = (value, res) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      res.status(400).json({
        error: "Invalid mentor profile id",
        code: "INVALID_MENTOR_PROFILE_ID",
      });
      return false;
    }
    return true;
  };

  const mapWithUser = (profile, user) => ({
    ...toMentorProfileDTO(profile),
    user: user || profile.user?.toString?.() || profile.user,
  });

  const list = async (req, res, next) => {
    try {
      const profiles = await mentorProfileRepository.findAllMentorProfilesForAdmin();
      const users = await identityClient.getUserSummaries(
        profiles.map((profile) => profile.user.toString()),
        req.correlationId,
      );
      const userById = new Map(users.map((user) => [user._id.toString(), user]));
      return res.status(200).json({
        success: true,
        data: {
          mentors: profiles.map((profile) => mapWithUser(profile, userById.get(profile.user.toString()))),
          total: profiles.length,
        },
        message: "Mentor verifications retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getById = async (req, res, next) => {
    if (!requireId(req.params.mentorProfileId, res)) return;
    try {
      const profile = await mentorProfileRepository.findMentorProfileByIdForAdmin(
        req.params.mentorProfileId,
      );
      if (!profile) {
        return res.status(404).json({
          error: "Mentor profile not found",
          code: "MENTOR_PROFILE_NOT_FOUND",
        });
      }
      const [user] = await identityClient.getUserSummaries(
        [profile.user.toString()],
        req.correlationId,
      );
      return res.status(200).json({
        success: true,
        data: { mentor: mapWithUser(profile, user) },
        message: "Mentor verification retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const updateStatus = (verificationStatus) => async (req, res, next) => {
    if (!requireId(req.params.mentorProfileId, res)) return;
    try {
      const profile = await mentorProfileRepository.findMentorProfileByIdForAdminMutable(
        req.params.mentorProfileId,
      );
      if (!profile) {
        return res.status(404).json({
          error: "Mentor profile not found",
          code: "MENTOR_PROFILE_NOT_FOUND",
        });
      }
      if (profile.verificationStatus === verificationStatus) {
        return res.status(409).json({
          error: `Mentor is already ${verificationStatus}`,
          code: "VERIFICATION_STATE_UNCHANGED",
        });
      }
      profile.verificationStatus = verificationStatus;
      await mentorProfileRepository.saveMentorProfile(profile);
      return res.status(200).json({
        success: true,
        data: {
          mentorProfileId: profile._id.toString(),
          verificationStatus,
        },
        message: `Mentor verification status changed to ${verificationStatus}`,
      });
    } catch (error) {
      return next(error);
    }
  };

  return {
    list,
    getById,
    verify: updateStatus("verified"),
    revoke: updateStatus("unverified"),
  };
};

module.exports = createInternalAdminVerificationController;
