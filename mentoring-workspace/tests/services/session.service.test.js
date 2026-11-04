const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionService = require("../../services/session.service");

const createService = ({
  paymentsClient,
  profileClient,
  identityClient,
  requestOverrides = {},
  repositoryOverrides = {},
} = {}) => {
  const releaseCalls = [];
  const publishedEvents = [];
  const realtimeEvents = [];
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
    ...requestOverrides,
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
    ...repositoryOverrides,
  };
  return {
    service: createSessionService({
      sessionRepository: repository,
      notificationClient: {
        publish: async (event) => publishedEvents.push(event),
      },
      identityClient: identityClient === undefined ? {
        getUserSummaries: async (ids) =>
          ids.map((id) => ({
            _id: id,
            name: id === "mentor-1" ? "Mentor One" : "Mentee One",
            email:
              id === "mentor-1" ? "mentor@example.com" : "mentee@example.com",
          })),
      } : identityClient,
      paymentsClient: paymentsClient && {
        releaseEscrow: async (...args) => {
          releaseCalls.push(args);
          return paymentsClient(...args);
        },
      },
      profileClient,
      realtimePublisher: {
        publishToUser: (...args) => realtimeEvents.push(args),
      },
      logger: { warn() {} },
    }),
    request,
    releaseCalls,
    publishedEvents,
    realtimeEvents,
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

test("validates session reads, participants, meeting URLs, state, and slot indices", async () => {
  const missing = createService({ repositoryOverrides: { findById: async () => null } });
  await assert.rejects(missing.service.getSlots("missing", "mentee-1"), {
    code: "SESSION_NOT_FOUND",
  });
  const fixture = createService();
  await assert.rejects(fixture.service.getSlots("request-1", "outsider"), {
    code: "NOT_SESSION_PARTICIPANT",
  });
  const empty = createService({ requestOverrides: { selectedSlots: undefined } });
  const emptySlots = await empty.service.getSlots("request-1", "mentee-1");
  assert.equal(emptySlots.totalSlots, 0);
  assert.equal(emptySlots.progress, 0);

  for (const meetingLink of ["", "not a URL", "http://meet.google.com/abc", "https://evil.example/room"]) {
    await assert.rejects(
      fixture.service.setMeetingLink({
        connectRequestId: "request-1",
        slotIndex: "0",
        meetingLink,
        userId: "mentor-1",
      }),
      { code: meetingLink ? "INVALID_MEETING_LINK" : "MEETING_LINK_REQUIRED" },
    );
  }
  await assert.rejects(
    missing.service.setMeetingLink({
      connectRequestId: "missing",
      slotIndex: "0",
      meetingLink: "https://zoom.us/meeting",
      userId: "mentor-1",
    }),
    { code: "SESSION_NOT_FOUND" },
  );
  await assert.rejects(
    createService({ requestOverrides: { status: "completed" } }).service.setMeetingLink({
      connectRequestId: "request-1",
      slotIndex: "0",
      meetingLink: "https://zoom.us/meeting",
      userId: "mentor-1",
    }),
    { code: "SESSION_NOT_ACTIVE" },
  );
  await assert.rejects(
    fixture.service.setMeetingLink({
      connectRequestId: "request-1",
      slotIndex: "3",
      meetingLink: "https://zoom.us/meeting",
      userId: "mentor-1",
    }),
    { code: "INVALID_SLOT_INDEX" },
  );
});

test("completes slots, rejects cancelled slots, and handles unavailable escrow", async () => {
  const cancelled = createService({
    requestOverrides: {
      selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00", status: "cancelled" }],
    },
  });
  await assert.rejects(cancelled.service.markSlotComplete({
    connectRequestId: "request-1",
    slotIndex: "0",
    userId: "mentee-1",
  }), { code: "SLOT_CANCELLED" });

  const fixture = createService({
    requestOverrides: {
      selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00", status: "booked", mentorMarked: true }],
    },
  });
  const complete = await fixture.service.markSlotComplete({
    connectRequestId: "request-1",
    slotIndex: "0",
    userId: "mentee-1",
  });
  assert.equal(complete.bothMarked, true);
  assert.equal(complete.allComplete, true);
  assert.equal(complete.progress, 100);
  assert.equal(complete.escrowRelease, null);
});

test("additional-slot booking validates timing, participant, duplicates, and active state", async () => {
  const invalid = createService();
  for (const values of [
    { date: "", startTime: "10:00", endTime: "11:00" },
    { date: "2099-01-02", startTime: "12:00", endTime: "11:00" },
  ]) {
    await assert.rejects(invalid.service.addSlot({
      connectRequestId: "request-1",
      ...values,
      userId: "mentee-1",
    }), { code: "INVALID_SLOT" });
  }
  const missing = createService({ repositoryOverrides: { findById: async () => null } });
  await assert.rejects(missing.service.addSlot({
    connectRequestId: "missing",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentee-1",
  }), { code: "SESSION_NOT_FOUND" });

  const duplicate = createService();
  duplicate.request.selectedSlots.push({
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    status: "booked",
  });
  await assert.rejects(duplicate.service.addSlot({
    connectRequestId: "request-1",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentee-1",
  }), { code: "SLOT_EXISTS" });
  await assert.rejects(createService({ requestOverrides: { status: "completed" } }).service.addSlot({
    connectRequestId: "request-1",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentee-1",
  }), { code: "SESSION_NOT_ACTIVE" });
});

test("cancels slots only once and skips email when participant summaries are unavailable", async () => {
  const fixture = createService({ identityClient: null });
  const result = await fixture.service.cancelSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    reason: "  reschedule  ",
    userId: "mentor-1",
  });
  assert.equal(result.slot.cancelledBy, "mentor");
  assert.equal(result.slot.cancellationReason, "reschedule");
  await assert.rejects(fixture.service.cancelSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    reason: "",
    userId: "mentee-1",
  }), { code: "SLOT_CANCELLED" });

  await assert.rejects(createService({ repositoryOverrides: { findById: async () => null } }).service.cancelSlot({
    connectRequestId: "missing",
    slotIndex: "0",
    userId: "mentee-1",
  }), { code: "SESSION_NOT_FOUND" });
  await assert.rejects(createService({ requestOverrides: { status: "completed" } }).service.cancelSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    userId: "mentee-1",
  }), { code: "SESSION_NOT_ACTIVE" });
});

test("continues slot cancellation when Identity cannot supply email recipients", async () => {
  const fixture = createService({
    identityClient: {
      getUserSummaries: async () => { throw new Error("Identity unavailable"); },
    },
  });
  const cancelled = await fixture.service.cancelSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    reason: "reschedule",
    userId: "mentee-1",
  });
  assert.equal(cancelled.slot.status, "cancelled");
  assert.equal(fixture.realtimeEvents.length, 2);
  assert.deepEqual(fixture.publishedEvents, []);
});

test("reschedules only valid, active, noncancelled, nonduplicate slots", async () => {
  const fixture = createService();
  await assert.rejects(fixture.service.rescheduleSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "11:00",
    userId: "mentor-1",
  }), { code: "INVALID_SLOT" });
  const duplicate = createService();
  duplicate.request.selectedSlots.push({
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    status: "booked",
  });
  await assert.rejects(duplicate.service.rescheduleSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentor-1",
  }), { code: "SLOT_EXISTS" });
  await assert.rejects(createService({
    requestOverrides: {
      selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00", status: "cancelled" }],
    },
  }).service.rescheduleSlot({
    connectRequestId: "request-1",
    slotIndex: "0",
    date: "2099-01-02",
    startTime: "12:00",
    endTime: "13:00",
    userId: "mentor-1",
  }), { code: "SLOT_CANCELLED" });
});

test("availability uses defaults without Profile and delegates when it is available", async () => {
  const fixture = createService();
  assert.deepEqual(await fixture.service.getMentorAvailability(
    "request-1",
    45,
    "mentee-1",
    "corr-availability",
  ), {
    slots: [],
    timezone: "Asia/Kolkata",
    sessionDurations: [30, 60],
  });

  let args;
  const withProfile = createService({
    profileClient: {
      getMentorAvailability: async (...values) => {
        args = values;
        return { slots: ["available"] };
      },
    },
  });
  assert.deepEqual(await withProfile.service.getMentorAvailability(
    "request-1",
    30,
    "mentor-1",
    "corr-profile",
  ), { slots: ["available"] });
  assert.deepEqual(args, ["mentor-1", 30, "mentor-1", "corr-profile", "request-1"]);
  await assert.rejects(createService({
    repositoryOverrides: { findById: async () => null },
  }).service.getMentorAvailability("missing", 30, "mentee-1"), {
    code: "SESSION_NOT_FOUND",
  });
});

test("escrow retry safely skips when payment dependencies are unavailable", async () => {
  const noPayments = createService();
  assert.deepEqual(await noPayments.service.retryPendingEscrowReleases(), {
    attempted: 0,
    released: 0,
  });
  const noRepositoryFunction = createService({
    paymentsClient: async () => ({ status: "released" }),
    repositoryOverrides: { findPendingEscrowReleases: undefined },
  });
  assert.deepEqual(await noRepositoryFunction.service.retryPendingEscrowReleases(), {
    attempted: 0,
    released: 0,
  });
});
