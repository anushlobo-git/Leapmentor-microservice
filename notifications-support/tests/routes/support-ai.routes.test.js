const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createSupportRouter = require("../../routes/support.routes");
const createSupportController = require("../../controllers/support.controller");
const createAiRouter = require("../../routes/ai.routes");
const createAiController = require("../../controllers/ai.controller");
const { createAuthenticate, createOptionalAuthenticate } = require("../../middleware/authenticate");
const createAdminAuthenticate = require("../../middleware/adminAuthenticate");
const supportValidations = require("../../middleware/supportValidation");
const aiValidation = require("../../middleware/aiValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("support submission is public while admin retrieval and AI chat are protected", async () => {
  const supportController = createSupportController({ supportService: {
    submitTicket: async (body) => ({ _id: "ticket-1", email: body.email, status: "open" }),
    fetchAllTickets: async () => [{ _id: "ticket-1", status: "open" }],
    resolveTicket: async () => ({ _id: "ticket-1", status: "resolved" }),
  } });
  const aiController = createAiController({ aiService: { generateChatResponse: async () => "Answer" } });
  const secret = "test-secret";
  const serverDetails = await startServer({
    health: { isReady: () => true },
    supportRouter: createSupportRouter({
      controller: supportController,
      optionalAuthenticate: createOptionalAuthenticate({ accessSecret: secret }),
      adminAuthenticate: createAdminAuthenticate({ accessSecret: secret }),
      validations: supportValidations,
    }),
    aiRouter: createAiRouter({ controller: aiController, authenticate: createAuthenticate({ accessSecret: secret }), validation: aiValidation }),
  });
  try {
    const ticket = await fetch(`${serverDetails.url}/api/v1/support/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "user@example.com", subject: "Help", message: "Need help" }) });
    assert.equal(ticket.status, 201);
    const adminToken = jwt.sign({ id: "admin-1", role: "admin", type: "access" }, secret);
    const adminList = await fetch(`${serverDetails.url}/api/v1/support/messages`, { headers: { Cookie: `adminToken=${adminToken}` } });
    assert.equal(adminList.status, 200);
    const userToken = jwt.sign({ id: "user-1", type: "access" }, secret);
    const ai = await fetch(`${serverDetails.url}/api/v1/ai/chat`, { method: "POST", headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }) });
    assert.equal(ai.status, 200);
    assert.equal((await ai.json()).data.content[0].text, "Answer");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
