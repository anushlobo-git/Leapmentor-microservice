const createLeapRequestRepository = (LeapRequest) => ({
  findLatestByMenteeAndStatus: (menteeId, status, session) => {
    const query = LeapRequest.findOne({ mentee: menteeId, status }).sort({
      createdAt: -1,
    });
    return session ? query.session(session) : query;
  },
  create: async (data, session) => {
    const records = await LeapRequest.create(
      [data],
      session ? { session } : {},
    );
    return records[0];
  },
  findAll: (filter) => LeapRequest.find(filter).sort({ createdAt: -1 }).lean(),
  countByStatus: (status) => LeapRequest.countDocuments({ status }),
  findById: (id, session) => {
    const query = LeapRequest.findById(id);
    return session ? query.session(session) : query;
  },
  save: (request, session) => request.save(session ? { session } : undefined),
});

module.exports = createLeapRequestRepository;
