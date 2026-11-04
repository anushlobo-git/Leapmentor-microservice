const createPaymentsClient = ({ httpClient }) => {
  if (!httpClient?.request) {
    throw new Error("A payments HTTP client is required");
  }

  const provisionWallet = ({
    userId,
    roles,
    idempotencyKey,
    correlationId,
  }) => {
    if (!userId) throw new Error("userId is required");
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new Error("At least one role is required");
    }
    if (!idempotencyKey) throw new Error("idempotencyKey is required");

    return httpClient.request({
      method: "POST",
      path: "/internal/v1/wallets/provision",
      body: { userId, roles },
      correlationId,
      idempotencyKey,
    });
  };

  return {
    provisionWallet,
  };
};

module.exports = createPaymentsClient;
