const createLeapRequestsController = ({ leapRequestsService }) => ({
  getRequests: async (req, res, next) => {
    try {
      const requests = await leapRequestsService.getRequests(
        req.query.status,
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { requests },
          message: "Leap requests retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  getPendingCount: async (req, res, next) => {
    try {
      const count = await leapRequestsService.getPendingCount(
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { count },
          message: "Pending request count retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  approve: async (req, res, next) => {
    try {
      const result = await leapRequestsService.approve(
        req.params.id,
        req.admin._id,
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: result,
          message: "500 LP added successfully.",
        });
    } catch (error) {
      return next(error);
    }
  },
  reject: async (req, res, next) => {
    try {
      const request = await leapRequestsService.reject(
        req.params.id,
        req.admin._id,
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { request },
          message: "Request rejected.",
        });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createLeapRequestsController;
