const createSessionRepository = (ConnectRequest) => ({
  findById: (id) => ConnectRequest.findById(id),
  save: (request) => request.save(),
  findPendingEscrowReleases: (limit = 50) =>
    ConnectRequest.find({ escrowReleaseStatus: "pending" })
      .select("mentee")
      .limit(limit)
      .lean(),
  updateEscrowReleaseStatus: (id, status, error) =>
    ConnectRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          escrowReleaseStatus: status,
          escrowReleaseError: String(error || "").slice(0, 500),
        },
      },
      { new: true },
    ),
});

module.exports = createSessionRepository;
