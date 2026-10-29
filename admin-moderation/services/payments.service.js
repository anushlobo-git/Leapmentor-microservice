const DEFAULT_PAGINATION = {
  totalCount: 0,
  currentPage: 1,
  totalPages: 0,
  hasMore: false,
};

const normalizePagination = (pagination, page, limit) => {
  const source = pagination && typeof pagination === "object" ? pagination : {};
  const totalCount = Number.isFinite(Number(source.totalCount))
    ? Math.max(0, Number(source.totalCount))
    : DEFAULT_PAGINATION.totalCount;
  const currentPage = Number.isFinite(Number(source.currentPage))
    ? Math.max(1, Number(source.currentPage))
    : page;
  const totalPages = Number.isFinite(Number(source.totalPages))
    ? Math.max(0, Number(source.totalPages))
    : totalCount > 0
      ? Math.ceil(totalCount / limit)
      : DEFAULT_PAGINATION.totalPages;

  return {
    totalCount,
    currentPage,
    totalPages,
    hasMore:
      typeof source.hasMore === "boolean"
        ? source.hasMore
        : currentPage < totalPages,
  };
};

const createAdminPaymentsService = ({
  paymentsClient,
  workspaceClient,
  identityClient,
}) => {
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
      const usersResponse = await identityClient.listUsers(
        {
          search: query.search.trim(),
          page: 1,
          limit: 100,
        },
        correlationId,
      );
      userIds = (usersResponse?.data?.users || []).map((user) =>
        String(user._id),
      );
      if (!userIds.length) {
        return {
          transactions: [],
          pagination: { ...DEFAULT_PAGINATION },
        };
      }
    }
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Number.parseInt(query.limit, 10) || 15);
    const response = await paymentsClient.getAdminPaymentTransactions(
      {
        page,
        limit,
        type: query.type,
        userIds: userIds.join(","),
      },
      correlationId,
    );
    const data = response?.data || {};
    const transactions = await Promise.all(
      (data.transactions || []).map(async (transaction) => {
        try {
          const userResponse = await identityClient.getUser(
            transaction.userId,
            correlationId,
          );
          const user = userResponse?.data?.user;
          return {
            ...transaction,
            user: { name: user?.name || "-", email: user?.email || "-" },
          };
        } catch {
          return { ...transaction, user: { name: "-", email: "-" } };
        }
      }),
    );
    return {
      transactions,
      pagination: normalizePagination(data.pagination, page, limit),
    };
  };

  return { getStats, getRevenueChart, getTransactions };
};

module.exports = createAdminPaymentsService;
