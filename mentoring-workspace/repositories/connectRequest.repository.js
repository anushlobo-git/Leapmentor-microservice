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
    ConnectRequest.find({ mentee }).sort({ requestedAt: -1, createdAt: -1 }).lean();

  const findIncomingRequests = (mentor, status) =>
    ConnectRequest.find({
      mentor,
      ...(status ? { status } : {}),
    }).sort({ requestedAt: -1, createdAt: -1 }).lean();

  const findOngoingConnects = (userId) =>
    ConnectRequest.find({
      $or: [{ mentee: userId }, { mentor: userId }],
      status: { $in: ["accepted", "ongoing", "completed"] },
    }).sort({ updatedAt: -1 }).lean();

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

  return {
    createRequest,
    findPendingRequest,
    findSlotConflict,
    findById,
    findMyRequests,
    findIncomingRequests,
    findOngoingConnects,
    countCompletedSessionsByUser,
    countByStatus,
    updatePendingResponse,
    updateMenteeRequest,
    deleteRequest,
  };
};

module.exports = createConnectRequestRepository;
