const test = require("node:test");
const assert = require("node:assert/strict");

const createConnectRequestController = require("../../controllers/connectRequest.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invoke = async (handler, req) => {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("connect request controller delegates all request operations with user and correlation context", async () => {
  const calls = [];
  const service = Object.fromEntries(
    [
      "sendConnectRequest",
      "getMyRequests",
      "getIncomingRequests",
      "respondToRequest",
      "cancelRequest",
      "getOngoingConnects",
      "getConnectDetail",
      "getSimilarMentors",
      "referRequest",
    ].map((method) => [
      method,
      async (...args) => {
        calls.push([method, ...args]);
        return method === "cancelRequest" ? undefined : { operation: method };
      },
    ]),
  );
  const controller = createConnectRequestController({ connectRequestService: service });
  const req = {
    user: { _id: "user-1" },
    body: { status: "accepted", mentorId: "mentor-1" },
    params: { id: "request-1" },
    query: { status: "pending" },
    correlationId: "corr-1",
  };
  const methods = [
    ["send", 201, "Connect request sent successfully"],
    ["myRequests", 200, "Connect requests retrieved"],
    ["incoming", 200, "Incoming requests retrieved"],
    ["respond", 200, "Request accepted successfully"],
    ["cancel", 200, "Request cancelled successfully"],
    ["ongoing", 200, "Ongoing connects retrieved"],
    ["detail", 200, "Connect details retrieved"],
    ["similarMentors", 200, "Similar mentors retrieved"],
    ["refer", 200, "Request referred successfully"],
  ];

  for (const [method, statusCode, message] of methods) {
    const { res, error } = await invoke(controller[method], req);
    assert.equal(error, undefined, method);
    assert.equal(res.statusCode, statusCode, method);
    assert.equal(res.body.success, true, method);
    assert.equal(res.body.message, message, method);
  }
  assert.deepEqual(calls, [
    ["sendConnectRequest", "user-1", req.body, "corr-1"],
    ["getMyRequests", "user-1", "corr-1"],
    ["getIncomingRequests", "user-1", "pending", "corr-1"],
    ["respondToRequest", "request-1", "user-1", req.body, "corr-1"],
    ["cancelRequest", "request-1", "user-1"],
    ["getOngoingConnects", "user-1", "corr-1"],
    ["getConnectDetail", "request-1", "user-1", "corr-1"],
    ["getSimilarMentors", "request-1", "user-1", "corr-1"],
    ["referRequest", "request-1", "user-1", req.body, "corr-1"],
  ]);
});

test("connect request controller forwards failures from every operation", async () => {
  const methods = [
    ["send", "sendConnectRequest"],
    ["myRequests", "getMyRequests"],
    ["incoming", "getIncomingRequests"],
    ["respond", "respondToRequest"],
    ["cancel", "cancelRequest"],
    ["ongoing", "getOngoingConnects"],
    ["detail", "getConnectDetail"],
    ["similarMentors", "getSimilarMentors"],
    ["refer", "referRequest"],
  ];
  const service = Object.fromEntries(
    methods.map(([, method]) => [method, async () => { throw new Error(`${method} failed`); }]),
  );
  const controller = createConnectRequestController({ connectRequestService: service });
  const req = {
    user: { _id: "user-1" },
    body: { status: "rejected" },
    params: { id: "request-1" },
    query: {},
  };

  for (const [handlerName, serviceMethod] of methods) {
    const { error } = await invoke(controller[handlerName], req);
    assert.equal(error.message, `${serviceMethod} failed`, handlerName);
  }
});
