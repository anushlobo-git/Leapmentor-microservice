const PAYOUT_FIELDS =
  "mentee mentor completedAt totalAmount paymentStatus confirmedSlot sessionRate sessionCount";
const EARNINGS_FIELDS =
  "mentee mentor completedAt totalAmount mentorPayout paymentStatus paidAt";

const createFinanceRepository = (ConnectRequest) => ({
  findInvoiceContext: (requestId) => ConnectRequest.findById(requestId).lean(),
  findMentorSessions: (mentorId, status, since) => {
    const filter = { mentor: mentorId, status };
    if (status === "ongoing") filter.paymentStatus = "paid";
    if (since) filter.completedAt = { $gte: since };
    return ConnectRequest.find(filter).select(EARNINGS_FIELDS).lean();
  },
  countPayouts: (filter) => ConnectRequest.countDocuments(filter),
  findPayouts: (filter, { skip, limit }) =>
    ConnectRequest.find(filter)
      .select(PAYOUT_FIELDS)
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
});

module.exports = createFinanceRepository;
