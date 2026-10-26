const DEFAULT_DURATION_MINUTES = 60;

const createAvailabilityController = ({ availabilityService }) => {
  const getMyAvailability = async (req, res, next) => {
    try {
      const data = await availabilityService.getMyAvailability(req.user._id, {
        user: req.user,
      });
      return res.status(200).json({
        success: true,
        data,
        message: "Availability retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const createAvailability = async (req, res, next) => {
    try {
      const availability = await availabilityService.createAvailability(
        req.user._id,
        req.body,
        { user: req.user },
      );
      return res.status(201).json({
        success: true,
        data: { availability },
        message: "Availability created successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const updateAvailability = async (req, res, next) => {
    try {
      const availability = await availabilityService.updateAvailability(
        req.user._id,
        req.body,
        { user: req.user },
      );
      return res.status(200).json({
        success: true,
        data: { availability },
        message: "Availability updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getMentorAvailability = async (req, res, next) => {
    try {
      const data = await availabilityService.getMentorAvailability(req.params.mentorId);
      return res.status(200).json({
        success: true,
        data,
        message: "Mentor availability retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const deleteAvailability = async (req, res, next) => {
    try {
      await availabilityService.deleteAvailability(req.user._id, { user: req.user });
      return res.status(200).json({
        success: true,
        data: null,
        message: "Availability cleared successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getAvailableSlots = async (req, res, next) => {
    try {
      const duration = req.availabilityDuration ||
        Number.parseInt(req.query.duration, 10) ||
        DEFAULT_DURATION_MINUTES;
      const data = await availabilityService.getAvailableSlots(
        req.params.mentorId,
        duration,
        req.user._id,
        { correlationId: req.correlationId },
      );
      return res.status(200).json({
        success: true,
        data,
        message: "Available slots retrieved",
      });
    } catch (error) {
      return next(error);
    }
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

module.exports = createAvailabilityController;
