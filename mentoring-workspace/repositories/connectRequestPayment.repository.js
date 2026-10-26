const PAYMENT_FIELDS = [
  "mentee",
  "mentor",
  "status",
  "paymentStatus",
  "sessionRate",
  "sessionCount",
  "totalAmount",
  "commissionRate",
  "commissionAmount",
  "mentorPayout",
  "paidAt",
  "completedAt",
  "selectedSlots",
  "confirmedSlot",
  "additionalSlots",
].join(" ");

const TOP_LEVEL_PAYMENT_FIELDS = new Set([
  "sessionRate",
  "sessionCount",
  "totalAmount",
  "commissionRate",
  "commissionAmount",
  "mentorPayout",
  "paymentStatus",
  "status",
  "paidAt",
  "completedAt",
]);

const createConnectRequestPaymentRepository = (ConnectRequest) => {
  const findPaymentContext = (requestId) =>
    ConnectRequest.findById(requestId).select(PAYMENT_FIELDS).lean();

  const updatePaymentState = (requestId, state) => {
    const update = {};
    if (state.additionalSlotId) {
      for (const field of ["paymentStatus", "paidAt", "sessionRate", "totalAmount"]) {
        if (Object.hasOwn(state, field)) {
          update[`additionalSlots.$.${field}`] = state[field];
        }
      }
      return ConnectRequest.findOneAndUpdate(
        { _id: requestId, "additionalSlots._id": state.additionalSlotId },
        { $set: update },
        { new: true, runValidators: true },
      ).lean();
    }

    for (const field of TOP_LEVEL_PAYMENT_FIELDS) {
      if (Object.hasOwn(state, field)) update[field] = state[field];
    }

    return ConnectRequest.findByIdAndUpdate(
      requestId,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
  };

  return { findPaymentContext, updatePaymentState };
};

module.exports = createConnectRequestPaymentRepository;
