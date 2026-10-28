const idOf = (value) =>
  value?._id?.toString?.() ?? value?.toString?.() ?? value;

const toTransactionDTO = (transaction) => {
  let status = "completed";
  if (transaction.type === "escrow_refund") status = "refunded";
  if (["escrow_hold", "withdrawal"].includes(transaction.type))
    status = "pending";
  return {
    _id: idOf(transaction._id),
    id: idOf(transaction._id),
    txId: transaction._id
      ? `#TRX-${String(transaction._id).slice(-5).toUpperCase()}`
      : "-",
    userId: idOf(transaction.user),
    user: { name: "-", email: "-" },
    amount: transaction.amount || 0,
    type: transaction.type || "-",
    description: transaction.description || "-",
    status,
    date: transaction.createdAt
      ? new Date(transaction.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "-",
  };
};

module.exports = { toTransactionDTO };
