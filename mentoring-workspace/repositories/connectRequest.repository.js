const createConnectRequestRepository = (ConnectRequest) => {
  const createRequest = (data) => ConnectRequest.create(data);

  const findPendingRequest = (mentee, mentor) =>
    ConnectRequest.findOne({ mentee, mentor, status: "pending" }).lean();

  const findSlotConflict = (mentor, slot) =>
    ConnectRequest.findOne({
      mentor,
      status: { $in: ["accepted", "ongoing"] },
      selectedSlots: {
        $elemMatch: {
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: { $ne: "cancelled" },
        },
      },
    }).lean();

  const findById = (id) => ConnectRequest.findById(id).lean();

  const findMyRequests = (mentee) =>
    ConnectRequest.find({ mentee })
      .sort({ requestedAt: -1, createdAt: -1 })
      .lean();

  const findIncomingRequests = (mentor, status) =>
    ConnectRequest.find({
      mentor,
      ...(status ? { status } : {}),
    })
      .sort({ requestedAt: -1, createdAt: -1 })
      .lean();

  const findOngoingConnects = (userId) =>
    ConnectRequest.find({
      $or: [{ mentee: userId }, { mentor: userId }],
      status: { $in: ["accepted", "ongoing", "completed"] },
    })
      .sort({ updatedAt: -1 })
      .lean();

  const findAcceptedSessionsForReminders = () =>
    ConnectRequest.find({ status: "accepted", confirmedSlot: { $ne: null } })
      .select("mentee mentor confirmedSlot")
      .lean();

  const findCompletedPaidSessions = () =>
    ConnectRequest.find({
      status: "completed",
      paymentStatus: "paid",
      totalAmount: { $gt: 0 },
    })
      .select("totalAmount commissionAmount")
      .lean();

  const countRefundedRequests = () =>
    ConnectRequest.countDocuments({ paymentStatus: "refunded" });

  const findSessionsByMonth = (monthStart, monthEnd) =>
    ConnectRequest.find({
      status: "completed",
      completedAt: { $gte: monthStart, $lt: monthEnd },
    })
      .select("totalAmount")
      .lean();

  const countCompletedSessionsByUser = (userId) =>
    ConnectRequest.countDocuments({
      $or: [{ mentee: userId }, { mentor: userId }],
      status: "completed",
    });

  const countByStatus = (status) => ConnectRequest.countDocuments({ status });

  const updatePendingResponse = (id, mentor, update) =>
    ConnectRequest.findOneAndUpdate(
      { _id: id, mentor, status: "pending" },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

  const updateMenteeRequest = (id, mentee, update) =>
    ConnectRequest.findOneAndUpdate(
      { _id: id, mentee },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

  const deleteRequest = (id, mentee) =>
    ConnectRequest.deleteOne({ _id: id, mentee });

  const markReferred = (id, mentor, update) =>
    ConnectRequest.findOneAndUpdate(
      { _id: id, mentor, status: "pending" },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

  return {
    createRequest,
    findPendingRequest,
    findSlotConflict,
    findById,
    findMyRequests,
    findIncomingRequests,
    findOngoingConnects,
    findAcceptedSessionsForReminders,
    findCompletedPaidSessions,
    countRefundedRequests,
    findSessionsByMonth,
    countCompletedSessionsByUser,
    countByStatus,
    updatePendingResponse,
    updateMenteeRequest,
    deleteRequest,
    markReferred,
  };
};

module.exports = createConnectRequestRepository;
