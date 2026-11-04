const createInternalHttpClient = ({
  baseUrl,
  serviceToken,
  timeoutMs = 3000,
  fetchImpl = globalThis.fetch,
}) => {
  const request = async ({ method, path, body, correlationId }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      Accept: "application/json",
      "X-Correlation-ID": correlationId || "not-provided",
      Authorization: `Bearer ${serviceToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      const parsed = raw ? JSON.parse(raw) : null;
      if (!response.ok) {
        const error = new Error(
          parsed?.message || parsed?.error || `Internal service failed with ${response.status}`,
        );
        error.statusCode = response.status;
        throw error;
      }
      return parsed;
    } catch (error) {
      if (error.name === "AbortError") {
        error.code = "INTERNAL_SERVICE_TIMEOUT";
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return { request };
};

module.exports = createInternalHttpClient;
