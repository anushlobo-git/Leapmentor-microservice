const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionService = require("../../services/session.service");

const createService = ({ paymentsClient } = {}) => {
  const releaseCalls = [];
  const publishedEvents = [];
  const request = {
    _id: "request-1",
    mentor: "mentor-1",
    mentee: "mentee-1",
    status: "ongoing",
    selectedSlots: [
      {
        date: "2099-01-01",
        startTime: "10:00",
        endTime: "11:00",
        status: "booked",
      },
    ],
    additionalSlots: [],
  };
  const repository = {
    findById: async () => request,
    save: async (value) => value,
    findPendingEscrowReleases: async () =>
      request.escrowReleaseStatus === "pending" ? [request] : [],
    updateEscrowReleaseStatus: async (_id, status, error) => {
      request.escrowReleaseStatus = status;
      request.escrowReleaseError = error || "";
      return request;
    },
  };
  return {
    service: createSessionService({
      sessionRepository: repository,
      notificationClient: {
        publish: async (event) => publishedEvents.push(event),
      },
      identityClient: {
        getUserSummaries: async (ids) =>
          ids.map((id) => ({
            _id: id,
            name: id === "mentor-1" ? "Mentor One" : "Mentee One",
            email:
              id === "mentor-1" ? "mentor@example.com" : "mentee@example.com",
          })),
      },
      paymentsClient: paymentsClient && {
        releaseEscrow: async (...args) => {
          releaseCalls.push(args);
          return paymentsClient(...args);
        },
      },
      logger: { warn() {} },
    }),
    request,
    releaseCalls,
    publishedEvents,
  };
};

test("reads slots and computes progress for a session participant", async () => {
  const { service } = createService();
  const result = await service.getSlots("request-1", "mentee-1");
  assert.equal(result.totalSlots, 1);
  assert.equal(result.progress, 0);
});

test("accepts trusted meeting links and rejects untrusted domains", async () => {
  const { service } = createService();
  const result = await service.setMeetingLink({
    connectRequestId: "request-1",
    slotIndex: "0",
    meetingLink: "https://meet.google.com/abc",
    userId: "mentor-1",
  });
  assert.equal(result.slot.meetingLink, "https://meet.google.com/abc");
  await assert.rejects(
    service.setMeetingLink({
      connectRequestId: "request-1",
      slotIndex: "0",
      meetingLink: "https://evil.example.com/room",
      userId: "mentor-1",
    }),
    { statusCode: 400, code: "INVALID_MEETING_LINK" },
  );
});

test("marks completion per participant and prevents duplicate marks", async () => {
  const { service, request } = createService();
  const first = await service.markSlotComplete({
    connectRequestId: "request-1",
    slotIndex: "0",
    userId: "mentee-1",
  });
  assert.equal(first.bothMarked, false);
  assert.equal(first.slot.menteeMarked, true);
  assert.equal(first.slot.mentorMarked, false);
  assert.equal(request.selectedSlots[0].menteeMarked, true);
  await assert.rejects(
    service.markSlotComplete({
      connectRequestId: "request-1",
      slotIndex: "0",
      userId: "mentee-1",
    }),
    { statusCode: 400, code: "SLOT_ALREADY_MARKED" },
  );
});

test("persists and retries a failed final escrow release", async () => {
  let failFirst = true;
  const { service, request, releaseCalls } = createService({
    paymentsClient: async () => {
      if (failFirst) {
        failFirst = false;
        throw new Error("Payments unavailable");
      }
      return { status: "completed" };
    },
  });
  request.selectedSlots[0].mentorMarked = true;

  const result = await service.markSlotComplete({
    connectRequestId: "request-1",
    slotIndex: "0",
    userId: "mentee-1",
  });
  assert.equal(result.allComplete, true);
  assert.equal(request.escrowReleaseStatus, "pending");

  const retryResult = await service.retryPendingEscrowReleases("corr-retry");
  assert.equal(retryResult.released, 1);
  assert.equal(request.escrowReleaseStatus, "released");
  assert.equal(releaseCalls.length, 2);

  assert.deepEqual(await service.retryPendingEscrowReleases("corr-idle"), {
    attempted: 0,
    released: 0,
  });
  assert.equal(releaseCalls.length, 2);
});

test("adds, cancels, and reschedules session slots", async () => {
  const { service, request, publishedEvents } = createService();
  request.additionalSlots.push = function (slot) {
    return Array.prototype.push.call(this, { _id: "additional-1", ...slot });
  };
  const added = await service.addSlot({
    connectRequestId: "request-1",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentee-1",
    correlationId: "corr-add",
  });
  assert.equal(added.slotId, "additional-1");
  assert.equal(added.slot.day, "Friday");
  assert.equal(added.additionalSlots.length, 1);
  assert.equal(added.slots.length, 1);
  assert.equal(added.totalSlots, 1);
  assert.equal(request.selectedSlots.some((slot) => slot.date === "2099-01-02"), false);
  assert.equal(request.additionalSlots[0].paymentStatus, "pending");
  const cancelled = await service.cancelSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    reason: "Change of plans",
    userId: "mentee-1",
    correlationId: "corr-cancel",
  });

  test("prevents mentors from booking additional sessions without mentee payment", async () => {
    const { service, request } = createService();
    await assert.rejects(
      service.addSlot({
        connectRequestId: "request-1",
        date: "2099-01-02",
        startTime: "12:00",
        endTime: "13:00",
        userId: "mentor-1",
      }),
      { statusCode: 403, code: "MENTEE_PAYMENT_REQUIRED" },
    );
    assert.equal(request.additionalSlots.length, 0);
  });
  assert.equal(cancelled.slot.status, "cancelled");
  request.selectedSlots[0].status = "booked";
  const rescheduled = await service.rescheduleSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    date: "2099-01-03",
    startTime: "14:00",
    endTime: "15:00",
    userId: "mentor-1",
    correlationId: "corr-reschedule",
  });
  assert.equal(rescheduled.slot.isRescheduled, true);
  assert.deepEqual(
    publishedEvents.map((event) => event.eventType),
    ["session.slot-cancelled.email", "session.slot-rescheduled.email"],
  );
});

test("reuses an unpaid additional slot when the mentee retries payment", async () => {
  const { service, request } = createService();
  request.additionalSlots.push({
    _id: "additional-pending",
    day: "Friday",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    paymentStatus: "pending",
  });

  const result = await service.addSlot({
    connectRequestId: "request-1",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentee-1",
  });

  assert.equal(result.slotId, "additional-pending");
  assert.equal(result.additionalSlots.length, 1);
  assert.equal(result.slots.length, 1);
});
