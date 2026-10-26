const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionService = require("../../services/session.service");

const createService = () => {
  const request = {
    _id: "request-1",
    mentor: "mentor-1",
    mentee: "mentee-1",
    status: "ongoing",
    selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00", status: "booked" }],
    additionalSlots: [],
  };
  const repository = {
    findById: async () => request,
    save: async (value) => value,
  };
  return { service: createSessionService({ sessionRepository: repository }), request };
};

test("reads slots and computes progress for a session participant", async () => {
  const { service } = createService();
  const result = await service.getSlots("request-1", "mentee-1");
  assert.equal(result.totalSlots, 1);
  assert.equal(result.progress, 0);
});

test("accepts trusted meeting links and rejects untrusted domains", async () => {
  const { service } = createService();
  const result = await service.setMeetingLink({ connectRequestId: "request-1", slotIndex: "0", meetingLink: "https://meet.google.com/abc", userId: "mentor-1" });
  assert.equal(result.slot.meetingLink, "https://meet.google.com/abc");
  await assert.rejects(service.setMeetingLink({ connectRequestId: "request-1", slotIndex: "0", meetingLink: "https://evil.example.com/room", userId: "mentor-1" }), { statusCode: 400, code: "INVALID_MEETING_LINK" });
});

test("marks completion per participant and prevents duplicate marks", async () => {
  const { service } = createService();
  const first = await service.markSlotComplete({ connectRequestId: "request-1", slotIndex: "0", userId: "mentee-1" });
  assert.equal(first.bothMarked, false);
  await assert.rejects(service.markSlotComplete({ connectRequestId: "request-1", slotIndex: "0", userId: "mentee-1" }), { statusCode: 400, code: "SLOT_ALREADY_MARKED" });
});

test("adds, cancels, and reschedules session slots", async () => {
  const { service, request } = createService();
  const added = await service.addSlot({ connectRequestId: "request-1", date: "2099-01-02", startTime: "12:00", endTime: "13:00", userId: "mentor-1" });
  assert.equal(added.additionalSlots.length, 1);
  const cancelled = await service.cancelSlot({ connectRequestId: "request-1", slotIndex: "0", reason: "Change of plans", userId: "mentee-1" });
  assert.equal(cancelled.slot.status, "cancelled");
  request.selectedSlots[0].status = "booked";
  const rescheduled = await service.rescheduleSlot({ connectRequestId: "request-1", slotIndex: "0", date: "2099-01-03", startTime: "14:00", endTime: "15:00", userId: "mentor-1" });
  assert.equal(rescheduled.slot.isRescheduled, true);
});
