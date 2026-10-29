const createTransactionRepository = (Transaction) => {
  const countTransactions = (filter) => Transaction.countDocuments(filter);

  const findTransactions = (filter, { skip, limit }) =>
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

  const findEscrowReleaseByKey = (idempotencyKey) =>
    Transaction.findOne({ type: "escrow_release", idempotencyKey }).lean();

  const createTransaction = async (data, session) => {
    const created = await Transaction.create(
      [data],
      session ? { session } : {},
    );
    return created[0];
  };

  // Mongoose requires ordered=true when creating multiple documents with a
  // session. Escrow release writes three ledger rows in one transaction; the
  // previous call aborted that transaction in the local Mongo setup.
  const createMany = (transactionData, session) =>
    Transaction.create(
      transactionData,
      session ? { session, ordered: true } : {},
    );

  return {
    countTransactions,
    findTransactions,
    findEscrowReleaseByKey,
    createTransaction,
    createMany,
  };
};

module.exports = createTransactionRepository;
