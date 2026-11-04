const STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "referred",
  "ongoing",
  "completed",
];

const toEngagementDTO = (request) => ({
  _id: request._id?.toString?.() || request._id,
  mentee: request.mentee?.toString?.() || request.mentee,
  mentor: request.mentor?.toString?.() || request.mentor,
  message: request.message,
  selectedSlots: request.selectedSlots,
  confirmedSlot: request.confirmedSlot,
  status: request.status,
  referredTo: request.referredTo,
  referredRequestId: request.referredRequestId,
  referredBy: request.referredBy,
  sessionRate: request.sessionRate,
  sessionCount: request.sessionCount,
  totalAmount: request.totalAmount,
  paymentStatus: request.paymentStatus,
  paidAt: request.paidAt,
  completedAt: request.completedAt,
  requestedAt: request.requestedAt,
  respondedAt: request.respondedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  commissionRate: request.commissionRate,
  commissionAmount: request.commissionAmount,
  mentorPayout: request.mentorPayout,
  additionalSlots: request.additionalSlots,
});

const createInternalAdminStatsController = ({ connectRequestRepository }) => {
  const getEngagementStats = async (_req, res, next) => {
    try {
      const counts = await Promise.all(
        STATUSES.map((status) =>
          connectRequestRepository.countByStatus(status),
        ),
      );
      const data = Object.fromEntries(
        STATUSES.map((status, index) => [status, counts[index]]),
      );
      data.total = counts.reduce((total, count) => total + count, 0);

      return res.status(200).json({
        success: true,
        data,
        message: "Engagement stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getEngagements = async (req, res, next) => {
    try {
      const {
        status,
        dateFrom,
        dateTo,
        userIds: rawUserIds,
        menteeId,
        page = 1,
        limit = 15,
      } = req.query;
      const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number.parseInt(limit, 10) || 15),
      );
      const filter = {};

      if (status) filter.status = status;
      if (menteeId) filter.mentee = String(menteeId);
      if (dateFrom || dateTo) {
        filter.requestedAt = {};
        if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
        if (dateTo) {
          filter.requestedAt.$lte = new Date(
            new Date(dateTo).setHours(23, 59, 59, 999),
          );
        }
      }

      if (rawUserIds !== undefined) {
        const userIds = String(rawUserIds).split(",").filter(Boolean);
        filter.$or = [
          { mentor: { $in: userIds } },
          { mentee: { $in: userIds } },
        ];
      }

      const [total, rows] = await Promise.all([
        connectRequestRepository.countByFilter(filter),
        connectRequestRepository.findEngagements(filter, {
          skip: (pageNumber - 1) * pageSize,
          limit: pageSize,
        }),
      ]);
      const engagements = rows.map(toEngagementDTO);

      return res.status(200).json({
        success: true,
        data: {
          engagements,
          pagination: {
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        message: "Engagements retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getEngagementStats, getEngagements };
};

module.exports = createInternalAdminStatsController;
