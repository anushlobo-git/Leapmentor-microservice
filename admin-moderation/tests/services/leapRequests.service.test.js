const test = require("node:test");
const assert = require("node:assert/strict");

const createLeapRequestsService = require("../../services/leapRequests.service");

test("decorates wallet requests with batched Identity user summaries", async () => {
  let summaryLookup;
  const service = createLeapRequestsService({
    paymentsClient: {
      listLeapRequests: async () => ({
        data: {
          requests: [
            { _id: "request-1", mentee: "mentee-1" },
            { _id: "request-2", mentee: { _id: "mentee-1" } },
            { _id: "request-3", mentee: { id: "missing-user", name: "Mentee" } },
          ],
        },
      }),
    },
    identityClient: {
      getUserSummaries: async (userIds, correlationId) => {
        summaryLookup = { userIds, correlationId };
        return [
          {
            _id: "mentee-1",
            name: "Jane Mentee",
            email: "jane@example.com",
          },
        ];
      },
    },
  });

  const requests = await service.getRequests("pending", "correlation-1");

  assert.deepEqual(summaryLookup, {
    userIds: ["mentee-1", "missing-user"],
    correlationId: "correlation-1",
  });
  assert.deepEqual(requests[0].mentee, {
    _id: "mentee-1",
    name: "Jane Mentee",
    email: "jane@example.com",
  });
  assert.deepEqual(requests[1].mentee, requests[0].mentee);
  assert.deepEqual(requests[2].mentee, {
    id: "missing-user",
    _id: "missing-user",
    name: "Mentee",
    email: "",
  });
});

test("does not pass arbitrary object values as Identity user IDs", async () => {
  let summaryLookup;
  const service = createLeapRequestsService({
    paymentsClient: {
      listLeapRequests: async () => ({
        data: { requests: [{ _id: "request-1", mentee: { name: "Mentee" } }] },
      }),
    },
    identityClient: {
      getUserSummaries: async (userIds) => {
        summaryLookup = userIds;
        return [];
      },
    },
  });

  const [request] = await service.getRequests();

  assert.deepEqual(summaryLookup, []);
  assert.deepEqual(request.mentee, {
    name: "Mentee",
    email: "",
  });
});

test("propagates Identity lookup failures instead of returning IDs as successful user records", async () => {
  const service = createLeapRequestsService({
    paymentsClient: {
      listLeapRequests: async () => ({
        data: { requests: [{ _id: "request-1", mentee: "mentee-1" }] },
      }),
    },
    identityClient: {
      getUserSummaries: async () => {
        throw new Error("Identity unavailable");
      },
    },
  });

  await assert.rejects(service.getRequests(), /Identity unavailable/);
});

test("supports pending count, approval, and rejection payment operations", async () => {
  const calls = [];
  const service = createLeapRequestsService({
    paymentsClient: {
      getPendingLeapRequestCount: async (correlationId) => {
        calls.push(["count", correlationId]);
        return { data: { count: 4 } };
      },
      approveLeapRequest: async (...args) => {
        calls.push(["approve", ...args]);
        return { data: { request: { _id: "request-1", status: "accepted" } } };
      },
      rejectLeapRequest: async (...args) => {
        calls.push(["reject", ...args]);
        return { data: { request: { _id: "request-2", status: "rejected" } } };
      },
    },
    identityClient: {},
  });

  assert.equal(await service.getPendingCount("corr-count"), 4);
  assert.deepEqual(await service.approve("request-1", "admin-1", "corr-approve"), {
    request: { _id: "request-1", status: "accepted" },
  });
  assert.deepEqual(await service.reject("request-2", "admin-2", "corr-reject"), {
    _id: "request-2",
    status: "rejected",
  });
  assert.deepEqual(calls, [
    ["count", "corr-count"],
    ["approve", "request-1", "admin-1", "corr-approve"],
    ["reject", "request-2", "admin-2", "corr-reject"],
  ]);
});

test("uses empty or null fallbacks when Payments omits operation data", async () => {
  const service = createLeapRequestsService({
    paymentsClient: {
      getPendingLeapRequestCount: async () => ({ data: {} }),
      approveLeapRequest: async () => ({}),
      rejectLeapRequest: async () => ({ data: {} }),
    },
    identityClient: {},
  });

  assert.equal(await service.getPendingCount(), 0);
  assert.deepEqual(await service.approve("request-1", "admin-1"), {});
  assert.equal(await service.reject("request-1", "admin-1"), null);
});
