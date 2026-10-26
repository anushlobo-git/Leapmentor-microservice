const createIdempotencyRepository = (IdempotencyKey) => {
  const findByKey = (key) => IdempotencyKey.findOne({ key }).lean();

  const createPending = (data) => IdempotencyKey.create(data);

  const markSucceeded = (key, responseBody, session) => {
    const query = IdempotencyKey.findOneAndUpdate(
      { key },
      { $set: { status: "succeeded", responseBody } },
      { new: true },
    );
    return session ? query.session(session) : query;
  };

  const deletePending = (key) =>
    IdempotencyKey.deleteOne({ key, status: "pending" });

  return {
    findByKey,
    createPending,
    markSucceeded,
    deletePending,
  };
};

module.exports = createIdempotencyRepository;
