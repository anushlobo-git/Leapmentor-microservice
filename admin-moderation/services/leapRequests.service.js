const createLeapRequestsService = ({ paymentsClient, identityClient }) => {
  const getRequests = async (status, correlationId) => {
    const response = await paymentsClient.listLeapRequests(
      status,
      correlationId,
    );
    const requests = response?.data?.requests || [];
    const decorated = await Promise.all(
      requests.map(async (request) => {
        const menteeId = request.mentee;
        if (!menteeId) return request;
        try {
          const userResponse = await identityClient.getUser(
            menteeId,
            correlationId,
          );
          const user = userResponse?.data?.user || null;
          return {
            ...request,
            mentee: user ? { ...user, _id: user._id || menteeId } : menteeId,
          };
        } catch {
          return request;
        }
      }),
    );
    return decorated;
  };

  return {
    getRequests,
    getPendingCount: async (correlationId) => {
      const response =
        await paymentsClient.getPendingLeapRequestCount(correlationId);
      return response?.data?.count ?? 0;
    },
    approve: async (requestId, adminId, correlationId) => {
      const response = await paymentsClient.approveLeapRequest(
        requestId,
        adminId,
        correlationId,
      );
      return response?.data || {};
    },
    reject: async (requestId, adminId, correlationId) => {
      const response = await paymentsClient.rejectLeapRequest(
        requestId,
        adminId,
        correlationId,
      );
      return response?.data?.request || null;
    },
  };
};

module.exports = createLeapRequestsService;
