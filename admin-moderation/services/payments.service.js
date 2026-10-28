const createAdminPaymentsService = ({ paymentsClient, workspaceClient, identityClient }) => {
  const getStats = async (correlationId) => {
    const [paymentResponse, workspaceResponse] = await Promise.all([
      paymentsClient.getAdminPaymentSummary(correlationId),
      workspaceClient.getPaymentStats(correlationId),
    ]);
    return {
      ...(workspaceResponse?.data || {}),
      ...(paymentResponse?.data || {}),
    };
  };

  const getRevenueChart = async (correlationId) => {
    const response = await workspaceClient.getPaymentChart(correlationId);
    return response?.data || [];
  };

  const getTransactions = async (query = {}, correlationId) => {
    let userIds = [];
    if (query.search?.trim()) {
      const usersResponse = await identityClient.listUsers({
        search: query.search.trim(),
        page: 1,
        limit: 100,
      }, correlationId);
      userIds = (usersResponse?.data?.users || []).map((user) => String(user._id));
      if (!userIds.length) {
        return { transactions: [], pagination: { totalCount: 0, currentPage: 1, totalPages: 0, hasMore: false } };
      }
    }
    const response = await paymentsClient.getAdminPaymentTransactions({
      page: query.page || 1,
      limit: query.limit || 15,
      type: query.type,
      userIds: userIds.join(","),
    }, correlationId);
    const data = response?.data || {};
    const transactions = await Promise.all((data.transactions || []).map(async (transaction) => {
      try {
        const userResponse = await identityClient.getUser(transaction.userId, correlationId);
        const user = userResponse?.data?.user;
        return { ...transaction, user: { name: user?.name || "-", email: user?.email || "-" } };
      } catch {
        return { ...transaction, user: { name: "-", email: "-" } };
      }
    }));
    return { transactions, pagination: data.pagination || { totalCount: 0, currentPage: 1, totalPages: 0, hasMore: false } };
  };

  return { getStats, getRevenueChart, getTransactions };
};

module.exports = createAdminPaymentsService;