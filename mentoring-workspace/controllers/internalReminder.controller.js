const createInternalReminderController = ({
  connectRequestRepository,
  identityClient,
}) => ({
  listUpcomingSessions: async (req, res, next) => {
    try {
      const requests =
        await connectRequestRepository.findAcceptedSessionsForReminders();
      const userIds = requests
        .flatMap((request) => [request.mentee, request.mentor])
        .filter(Boolean);
      const users = await identityClient.getUserSummaryMap(
        userIds,
        req.correlationId,
      );
      const sessions = requests.map((request) => ({
        requestId: String(request._id),
        mentee: users.get(String(request.mentee)) || {
          _id: String(request.mentee),
        },
        mentor: users.get(String(request.mentor)) || {
          _id: String(request.mentor),
        },
        confirmedSlot: request.confirmedSlot,
      }));
      return res
        .status(200)
        .json({
          success: true,
          data: { sessions },
          message: "Upcoming sessions retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalReminderController;
