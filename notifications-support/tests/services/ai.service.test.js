const test = require("node:test");
const assert = require("node:assert/strict");

const createAiService = require("../../services/ai.service");

test("prepends the support system prompt and returns the model text", async () => {
  let request;
  const service = createAiService({ aiGateway: { executeChatCompletion: async (messages, maxTokens) => { request = { messages, maxTokens }; return { choices: [{ message: { content: "Helpful answer" } }] }; } } });
  const result = await service.generateChatResponse([{ role: "user", content: "How do I book?" }]);
  assert.equal(result, "Helpful answer");
  assert.equal(request.messages[0].role, "system");
  assert.equal(request.maxTokens, 1000);
});
