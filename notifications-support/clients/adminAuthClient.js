const createAdminAuthClient = ({
  baseUrl = process.env.ADMIN_SERVICE_URL,
  serviceToken = process.env.ADMIN_SERVICE_TOKEN,
  timeoutMs = 3000,
  fetchImpl = globalThis.fetch,
}) => ({
  validateAdminToken: async (token) => {
    if (!baseUrl || !serviceToken) {
      const error = new Error("Admin session validation is not configured");
      error.code = "ADMIN_VALIDATION_NOT_CONFIGURED";
      error.statusCode = 503;
      throw error;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        `${baseUrl}/internal/v1/admin-auth/validate-session`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceToken}`,
          },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        },
      );
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(
          body?.message || body?.error || "Admin session validation failed",
        );
        error.code = body?.code || "ADMIN_SESSION_VALIDATION_FAILED";
        error.statusCode = response.status;
        throw error;
      }
      return body?.data?.admin || null;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Admin session validation timed out");
        timeoutError.code = "ADMIN_SESSION_VALIDATION_TIMEOUT";
        timeoutError.statusCode = 503;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
});

module.exports = createAdminAuthClient;
