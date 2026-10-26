const createInternalHttpClient = ({
  baseUrl,
  serviceToken = "",
  timeoutMs = 3000,
  fetchImpl = globalThis.fetch,
}) => {
  if (!baseUrl) throw new Error("An internal service base URL is required");
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required");
  }

  const request = async ({ method, path, body, correlationId }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      Accept: "application/json",
      "X-Correlation-ID": correlationId || "not-provided",
    };
    if (serviceToken) headers.Authorization = `Bearer ${serviceToken}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let responseBody = null;
      if (rawBody) {
        try {
          responseBody = JSON.parse(rawBody);
        } catch {
          responseBody = { message: rawBody };
        }
      }

      if (!response.ok) {
        const error = new Error(
          responseBody?.message ||
            responseBody?.error ||
            `Internal service request failed with status ${response.status}`,
        );
        error.statusCode = response.status;
        error.responseBody = responseBody;
        throw error;
      }

      return responseBody;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error(
          `Internal service request timed out after ${timeoutMs}ms`,
        );
        timeoutError.code = "INTERNAL_SERVICE_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return { request };
};

module.exports = createInternalHttpClient;
