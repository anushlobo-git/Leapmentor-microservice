const MAX_TOKEN_LIMIT = 1000;
const DEFAULT_SYSTEM_PROMPT = "You are a helpful platform support assistant.";

const createAiService = ({ aiGateway }) => ({
  generateChatResponse: async (messages, systemPrompt) => {
    const normalizedMessages = Array.isArray(messages) ? messages : [];
    const data = await aiGateway.executeChatCompletion([
      { role: "system", content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...normalizedMessages,
    ], MAX_TOKEN_LIMIT);
    return data.choices?.[0]?.message?.content || "";
  },
});

module.exports = createAiService;
