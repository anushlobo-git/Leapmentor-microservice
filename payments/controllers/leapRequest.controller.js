const createLeapRequestController = ({ leapRequestService }) => ({
  getMyRequest: async (req, res, next) => {
    try {
      const request = await leapRequestService.getMyPendingRequest(
        req.user._id,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: request,
          message: "Pending leap request retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  createRequest: async (req, res, next) => {
    try {
      const request = await leapRequestService.createLeapRequest(req.user._id);
      return res
        .status(201)
        .json({
          success: true,
          data: { request },
          message: "Request submitted successfully.",
        });
    } catch (error) {
      return next(error);
    }
  },
  getAllRequests: async (req, res, next) => {
    try {
      const requests = await leapRequestService.getAllLeapRequests(
        req.query.status,
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
  getPendingCount: async (_req, res, next) => {
    try {
      const count = await leapRequestService.getPendingCount();
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
  approveRequest: async (req, res, next) => {
    try {
      const result = await leapRequestService.approveLeapRequest(
        req.params.id,
        req.body?.adminId,
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
  rejectRequest: async (req, res, next) => {
    try {
      const request = await leapRequestService.rejectLeapRequest(
        req.params.id,
        req.body?.adminId,
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

module.exports = createLeapRequestController;
