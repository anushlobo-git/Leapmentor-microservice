const createWorkspaceClient = ({
  baseUrl = process.env.WORKSPACE_SERVICE_URL,
  serviceToken = process.env.WORKSPACE_SERVICE_TOKEN,
  timeoutMs = 3000,
  fetchImpl = globalThis.fetch,
}) => {
  const isConfigured = () => Boolean(baseUrl && serviceToken);

  const listUpcomingSessions = async () => {
    if (!isConfigured()) {
      const error = new Error("Workspace reminder client is not configured");
      error.code = "WORKSPACE_REMINDER_CLIENT_NOT_CONFIGURED";
      throw error;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        `${baseUrl}/internal/v1/reminders/upcoming-sessions`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${serviceToken}`,
          },
          signal: controller.signal,
        },
      );
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(
          body?.message ||
            body?.error ||
            `Workspace request failed: ${response.status}`,
        );
        error.statusCode = response.status;
        throw error;
      }
      return body?.data?.sessions || [];
    } finally {
      clearTimeout(timeout);
    }
  };

  return { isConfigured, listUpcomingSessions };
};

module.exports = createWorkspaceClient;
