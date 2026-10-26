const test = require("node:test");
const assert = require("node:assert/strict");

const createConnectRequestService = require("../../services/connectRequest.service");

const createService = () => {
  const requests = [];
  const repository = {
    createRequest: async (data) => {
      const request = { _id: `request-${requests.length + 1}`, ...data };
      requests.push(request);
      return request;
    },
    findPendingRequest: async (mentee, mentor) =>
      requests.find((request) => request.mentee === mentee && request.mentor === mentor && request.status === "pending") || null,
    findSlotConflict: async (mentor, slot) =>
      requests.find((request) => request.mentor === mentor && ["accepted", "ongoing"].includes(request.status) && request.selectedSlots.some((candidate) => candidate.date === slot.date && candidate.startTime === slot.startTime && candidate.endTime === slot.endTime)) || null,
    findById: async (id) => requests.find((request) => request._id === id) || null,
    findMyRequests: async (mentee) => requests.filter((request) => request.mentee === mentee),
    findIncomingRequests: async (mentor, status) => requests.filter((request) => request.mentor === mentor && (!status || request.status === status)),
    findOngoingConnects: async (userId) => requests.filter((request) => ["accepted", "ongoing", "completed"].includes(request.status) && [request.mentee, request.mentor].includes(userId)),
    updatePendingResponse: async (id, mentor, update) => {
      const request = requests.find((item) => item._id === id && item.mentor === mentor && item.status === "pending");
      if (!request) return null;
      Object.assign(request, update);
      return request;
    },
    deleteRequest: async (id, mentee) => {
      const index = requests.findIndex((request) => request._id === id && request.mentee === mentee);
      if (index >= 0) requests.splice(index, 1);
    },
  };
  return { service: createConnectRequestService({ connectRequestRepository: repository }), requests };
};

test("creates a request after validating slots and prevents duplicate pending requests", async () => {
  const { service } = createService();
  const body = {
    mentorId: "mentor-1",
    message: "I would like guidance",
    sessionRate: 100,
    selectedSlots: [{ day: "Monday", date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
  };

  const created = await service.sendConnectRequest("mentee-1", body);
  assert.equal(created.status, "pending");
  await assert.rejects(service.sendConnectRequest("mentee-1", body), { statusCode: 409, code: "PENDING_REQUEST_EXISTS" });
});

test("lets the mentor accept a pending request and records the confirmed slot", async () => {
  const { service } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    sessionRate: 100,
    selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
  });

  const accepted = await service.respondToRequest(created._id, "mentor-1", {
    status: "accepted",
    confirmedSlot: { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.confirmedSlot.startTime, "10:00");
});

test("scopes cancellation, detail, and ongoing reads to the request participants", async () => {
  const { service } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [{ date: "2099-01-02", startTime: "10:00", endTime: "11:00" }],
  });
  await assert.rejects(service.getConnectDetail(created._id, "outsider"), { statusCode: 403, code: "NOT_REQUEST_PARTICIPANT" });
  await service.cancelRequest(created._id, "mentee-1");
  assert.deepEqual(await service.getMyRequests("mentee-1"), []);
});
