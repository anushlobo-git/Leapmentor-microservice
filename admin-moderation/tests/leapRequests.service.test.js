const test = require("node:test");
const assert = require("node:assert/strict");

const createLeapRequestsService = require("../services/leapRequests.service");

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
