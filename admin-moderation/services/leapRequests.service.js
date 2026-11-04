const createLeapRequestsService = ({ paymentsClient, identityClient }) => {
  const getMenteeId = (mentee) => {
    const value = mentee?._id ?? mentee?.id ?? mentee;
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (value && typeof value.toString === "function") {
      const id = value.toString();
      return id === "[object Object]" ? "" : id;
    }
    return "";
  };

  const getRequests = async (status, correlationId) => {
    const response = await paymentsClient.listLeapRequests(
      status,
      correlationId,
    );
    const requests = response?.data?.requests || [];
    const menteeIds = [
      ...new Set(
        requests
          .map((request) => getMenteeId(request.mentee))
          .filter(Boolean)
      ),
    ];
    const users = await identityClient.getUserSummaries(
      menteeIds,
      correlationId,
    );
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    return requests.map((request) => {
      const menteeId = getMenteeId(request.mentee);
      const user = usersById.get(menteeId);
      const existingMentee =
        request.mentee && typeof request.mentee === "object"
          ? request.mentee
          : {};
      return {
        ...request,
        mentee: user || {
          ...existingMentee,
          ...(menteeId ? { _id: menteeId } : {}),
          name: existingMentee.name || "Unavailable user",
          email: existingMentee.email || "",
        },
      };
    });
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
