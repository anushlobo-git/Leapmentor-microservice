const AppError = require("../utils/AppError");

const createAiGateway = ({ apiKey, endpoint, model, fetchImpl = globalThis.fetch }) => ({
  executeChatCompletion: async (messages, maxTokens) => {
    if (!apiKey) throw new AppError("AI gateway credentials configuration missing", 503, "AI_NOT_CONFIGURED");
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      });
    } catch (error) {
      throw new AppError(`AI endpoint connection failure: ${error.message}`, 502, "AI_GATEWAY_UNAVAILABLE");
    }
    const data = await response.json();
    if (!response.ok) throw new AppError("AI proxy engine gateway failure", response.status, "AI_GATEWAY_ERROR");
    return data;
  },
});

module.exports = createAiGateway;
