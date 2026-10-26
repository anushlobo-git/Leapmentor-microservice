const createTransactionRepository = (Transaction) => {
  const countTransactions = (filter) => Transaction.countDocuments(filter);

  const findTransactions = (filter, { skip, limit }) =>
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

  const createTransaction = async (data, session) => {
    const created = await Transaction.create(
      [data],
      session ? { session } : {},
    );
    return created[0];
  };

  const createMany = (transactionData, session) =>
    Transaction.create(transactionData, session ? { session } : {});

  return {
    countTransactions,
    findTransactions,
    createTransaction,
    createMany,
  };
};

module.exports = createTransactionRepository;
