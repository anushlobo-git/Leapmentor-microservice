const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createConnectRequestController = require("../../controllers/connectRequest.controller");
const createConnectRequestRouter = require("../../routes/connectRequest.routes");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/connectRequestValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("connect request creation authenticates the browser and preserves the public response envelope", async () => {
  const controller = createConnectRequestController({
    connectRequestService: {
      sendConnectRequest: async (userId, body) => ({ _id: "request-1", mentee: userId, ...body }),
      getMyRequests: async () => [],
      getIncomingRequests: async () => [],
      respondToRequest: async () => ({}),
      cancelRequest: async () => undefined,
      getOngoingConnects: async () => [],
      getConnectDetail: async () => ({}),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    connectRequestRouter: createConnectRequestRouter({
      controller,
      authenticate: createAuthenticate({ accessSecret: "test-secret" }),
      validations,
    }),
  });

  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/connect-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mentorId: "507f1f77bcf86cd799439011",
        selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
      }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.request.mentee, "mentee-1");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
