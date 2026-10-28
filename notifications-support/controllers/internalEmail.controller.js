const createInternalEmailController = ({ reportEmailService }) => ({
  sendReportEvent: async (req, res, next) => {
    try {
      const result = await reportEmailService.sendReportEvent(req.body || {});
      return res
        .status(202)
        .json({
          success: true,
          data: result,
          message: "Report email accepted",
        });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalEmailController;
