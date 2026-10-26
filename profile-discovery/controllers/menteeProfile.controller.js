const createMenteeProfileController = ({ menteeProfileService }) => {
  const createProfile = async (req, res, next) => {
    try {
      const profile = await menteeProfileService.createProfile(
        req.user._id,
        req.body,
        { correlationId: req.correlationId, user: req.user },
      );
      return res.status(201).json({
        success: true,
        data: { profile },
        message: "Mentee profile created successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getMyProfile = async (req, res, next) => {
    try {
      const profile = await menteeProfileService.getMyProfile(req.user._id, {
        correlationId: req.correlationId,
        user: req.user,
      });
      return res.status(200).json({
        success: true,
        data: profile,
        message: "Mentee profile retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const updateProfile = async (req, res, next) => {
    try {
      const profile = await menteeProfileService.updateMyProfile(
        req.user._id,
        req.body,
        { correlationId: req.correlationId, user: req.user },
      );
      return res.status(200).json({
        success: true,
        data: { profile },
        message: "Profile updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getPublicProfile = async (req, res, next) => {
    try {
      const profile = await menteeProfileService.getPublicProfile(req.params.id);
      return res.status(200).json({
        success: true,
        data: profile,
        message: "Mentee profile retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};

module.exports = createMenteeProfileController;
