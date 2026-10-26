const test = require("node:test");
const assert = require("node:assert/strict");

const createConnectRequestService = require("../../services/connectRequest.service");

test("connect request lifecycle publishes recipient-scoped notification events", async () => {
  const events = [];
  const requests = [];
  const repository = {
    findPendingRequest: async () => null,
    findSlotConflict: async () => null,
    createRequest: async (data) => { const request = { _id: "request-1", ...data }; requests.push(request); return request; },
    updatePendingResponse: async (_id, _mentor, update) => { Object.assign(requests[0], update); return requests[0]; },
  };
  const service = createConnectRequestService({
    connectRequestRepository: repository,
    notificationClient: { publish: async (event) => { events.push(event); } },
  });
  const created = await service.sendConnectRequest("mentee-1", { mentorId: "mentor-1", selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }] });
  await service.respondToRequest(created._id, "mentor-1", { status: "accepted", confirmedSlot: { date: "2099-01-01", startTime: "10:00", endTime: "11:00" } });
  assert.deepEqual(events.map((event) => event.type), ["connect_request_received", "connect_request_accepted"]);
  assert.equal(events[0].recipient, "mentor-1");
  assert.equal(events[1].recipient, "mentee-1");
});
