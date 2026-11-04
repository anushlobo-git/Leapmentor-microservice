const test = require("node:test");
const assert = require("node:assert/strict");

const ConnectRequest = require("../../models/ConnectRequest");

test("additional slots receive an id and payment defaults", async () => {
  const request = new ConnectRequest({
    additionalSlots: [
      {
        day: "Monday",
        date: "2026-11-02",
        startTime: "10:00",
        endTime: "11:00",
      },
    ],
  });

  const [slot] = request.additionalSlots;
  assert.ok(slot._id);
  assert.equal(slot.paymentStatus, "pending");
  assert.equal(slot.meetingLink, "");
  assert.equal(slot.sessionRate, null);
  await request.validate();
});

test("additional-slot payment state is constrained to valid values", async () => {
  const request = new ConnectRequest({
    additionalSlots: [
      {
        day: "Monday",
        date: "2026-11-02",
        startTime: "10:00",
        endTime: "11:00",
        paymentStatus: "failed",
      },
    ],
  });

  await assert.rejects(request.validate(), (error) =>
    Boolean(error.errors["additionalSlots.0.paymentStatus"]),
  );
});
