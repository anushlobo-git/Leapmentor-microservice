const test = require("node:test");
const assert = require("node:assert/strict");

const createConnectRequestService = require("../../services/connectRequest.service");

const createService = () => {
  const requests = [];
  const realtimeEvents = [];
  const notificationEvents = [];
  const repository = {
    createRequest: async (data) => {
      const request = { _id: `request-${requests.length + 1}`, ...data };
      requests.push(request);
      return request;
    },
    findPendingRequest: async (mentee, mentor) =>
      requests.find(
        (request) =>
          request.mentee === mentee &&
          request.mentor === mentor &&
          request.status === "pending",
      ) || null,
    findSlotConflict: async (mentor, slot) =>
      requests.find(
        (request) =>
          request.mentor === mentor &&
          ["accepted", "ongoing"].includes(request.status) &&
          request.selectedSlots.some(
            (candidate) =>
              candidate.date === slot.date &&
              candidate.startTime === slot.startTime &&
              candidate.endTime === slot.endTime,
          ),
      ) || null,
    findById: async (id) =>
      requests.find((request) => request._id === id) || null,
    findMyRequests: async (mentee) =>
      requests.filter((request) => request.mentee === mentee),
    findIncomingRequests: async (mentor, status) =>
      requests.filter(
        (request) =>
          request.mentor === mentor && (!status || request.status === status),
      ),
    findOngoingConnects: async (userId) =>
      requests.filter(
        (request) =>
          ["accepted", "ongoing", "completed"].includes(request.status) &&
          [request.mentee, request.mentor].includes(userId),
      ),
    updatePendingResponse: async (id, mentor, update) => {
      const request = requests.find(
        (item) =>
          item._id === id &&
          item.mentor === mentor &&
          item.status === "pending",
      );
      if (!request) return null;
      Object.assign(request, update);
      return request;
    },
    deleteRequest: async (id, mentee) => {
      const index = requests.findIndex(
        (request) => request._id === id && request.mentee === mentee,
      );
      if (index >= 0) requests.splice(index, 1);
    },
  };
  const service = createConnectRequestService({
    connectRequestRepository: repository,
    notificationClient: {
      publish: async (event) => {
        notificationEvents.push(event);
      },
    },
    identityClient: {
      getUserSummaries: async (ids) =>
        ids.map((id) => ({
          _id: id,
          name: id === "mentee-1" ? "Mentee One" : "Mentor One",
          email:
            id === "mentee-1" ? "mentee@example.com" : "mentor@example.com",
        })),
    },
    profileClient: {
      getMentorProfile: async () => ({ hourlyRate: 125 }),
    },
    realtimePublisher: {
      publishToUser: (recipient, event, payload) => {
        realtimeEvents.push({ recipient, event, payload });
      },
    },
  });
  return { service, requests, realtimeEvents, notificationEvents };
};

test("creates a request after validating slots and prevents duplicate pending requests", async () => {
  const { service, notificationEvents } = createService();
  const body = {
    mentorId: "mentor-1",
    message: "I would like guidance",
    sessionRate: 100,
    selectedSlots: [
      {
        day: "Monday",
        date: "2099-01-01",
        startTime: "10:00",
        endTime: "11:00",
      },
    ],
  };

  const created = await service.sendConnectRequest("mentee-1", body);
  assert.equal(created.status, "pending");
  const receivedEmail = notificationEvents.find(
    (event) => event.eventType === "connect.request.received.email",
  );
  assert.equal(receivedEmail.mentorEmail, "mentor@example.com");
  await assert.rejects(service.sendConnectRequest("mentee-1", body), {
    statusCode: 409,
    code: "PENDING_REQUEST_EXISTS",
  });
});

test("lets the mentor accept a pending request and records the confirmed slot", async () => {
  const { service, realtimeEvents, notificationEvents } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    sessionRate: 100,
    selectedSlots: [
      { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
    ],
  });
  const accepted = await service.respondToRequest(created._id, "mentor-1", {
    status: "accepted",
    confirmedSlot: { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.confirmedSlot.startTime, "10:00");
  assert.deepEqual(
    realtimeEvents.find((event) => event.event === "request_accepted").payload,
    {
      title: "Request Accepted",
      message: "Mentor One accepted your connect request.",
      type: "success",
    },
  );
  assert.ok(
    notificationEvents.some(
      (event) => event.eventType === "connect.request.accepted.email",
    ),
  );
});

test("resolves a missing session rate from the mentor profile when accepting", async () => {
  const { service } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [
      { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
    ],
  });
  created.sessionRate = null;
  created.totalAmount = null;

  const accepted = await service.respondToRequest(created._id, "mentor-1", {
    status: "accepted",
    confirmedSlot: { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
  });

  assert.equal(accepted.sessionRate, 125);
  assert.equal(accepted.sessionCount, 1);
  assert.equal(accepted.totalAmount, 125);
});

test("new connect request socket toast contains the frontend toast fields", async () => {
  const { service, realtimeEvents } = createService();
  await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [
      { date: "2099-01-03", startTime: "10:00", endTime: "11:00" },
    ],
  });

  assert.deepEqual(
    realtimeEvents.find((event) => event.event === "new_connect_request")
      .payload,
    {
      title: "New Connect Request",
      message: "Mentee One sent you a connect request.",
      type: "info",
    },
  );
});

test("connect request detail includes participant names and emails from Identity", async () => {
  const { service } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [
      { date: "2099-01-04", startTime: "10:00", endTime: "11:00" },
    ],
  });
  const detail = await service.getConnectDetail(
    created._id,
    "mentee-1",
    "corr-detail",
  );

  assert.deepEqual(detail.mentee, {
    _id: "mentee-1",
    name: "Mentee One",
    email: "mentee@example.com",
  });
  assert.deepEqual(detail.mentor, {
    _id: "mentor-1",
    name: "Mentor One",
    email: "mentor@example.com",
  });
});

test("scopes cancellation, detail, and ongoing reads to the request participants", async () => {
  const { service } = createService();
  const created = await service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [
      { date: "2099-01-02", startTime: "10:00", endTime: "11:00" },
    ],
  });
  await assert.rejects(service.getConnectDetail(created._id, "outsider"), {
    statusCode: 403,
    code: "NOT_REQUEST_PARTICIPANT",
  });
  await service.cancelRequest(created._id, "mentee-1");
  assert.deepEqual(await service.getMyRequests("mentee-1"), []);
});

const requestSlot = {
  day: "Monday",
  date: "2099-01-01",
  startTime: "10:00",
  endTime: "11:00",
};

const customService = (overrides = {}) => {
  const request = {
    _id: "request-1",
    mentee: "mentee-1",
    mentor: "mentor-1",
    status: "pending",
    selectedSlots: [requestSlot],
    sessionRate: 100,
    sessionCount: 1,
    totalAmount: 100,
    message: "Hello",
  };
  const repository = {
    findPendingRequest: async () => null,
    findSlotConflict: async () => null,
    createRequest: async (value) => ({ _id: "request-2", ...value }),
    findById: async () => request,
    findMyRequests: async () => [request],
    findIncomingRequests: async () => [request],
    findOngoingConnects: async () => [request],
    updatePendingResponse: async (_id, _mentor, update) => ({ ...request, ...update }),
    deleteRequest: async () => null,
    markReferred: async (_id, _mentor, update) => ({ ...request, ...update }),
    ...overrides.repository,
  };
  const events = [];
  const realtime = [];
  return {
    service: createConnectRequestService({
      connectRequestRepository: repository,
      notificationClient: { publish: async (event) => events.push(event) },
      identityClient: overrides.identityClient,
      profileClient: overrides.profileClient,
      realtimePublisher: {
        publishToUser: (...args) => realtime.push(args),
      },
    }),
    repository,
    events,
    realtime,
    request,
  };
};

const rejectsWithCode = (promise, code) =>
  assert.rejects(promise, (error) => error.code === code);

test("send request rejects invalid inputs, duplicate requests, and occupied slots", async () => {
  const fixture = customService();
  await rejectsWithCode(fixture.service.sendConnectRequest("mentee", {}), "MENTOR_REQUIRED");
  await rejectsWithCode(
    fixture.service.sendConnectRequest("same", { mentorId: "same", selectedSlots: [requestSlot] }),
    "SELF_REQUEST",
  );
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", { mentorId: "mentor", selectedSlots: [] }),
    "INVALID_SLOTS",
  );
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", {
      mentorId: "mentor",
      selectedSlots: Array(6).fill(requestSlot),
    }),
    "INVALID_SLOTS",
  );
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", {
      mentorId: "mentor",
      selectedSlots: [{ date: "2099-01-01" }],
    }),
    "INVALID_SLOT",
  );
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", {
      mentorId: "mentor",
      sessionRate: 0,
      selectedSlots: [requestSlot],
    }),
    "INVALID_SESSION_RATE",
  );
  fixture.repository.findPendingRequest = async () => ({ _id: "existing" });
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", {
      mentorId: "mentor",
      sessionRate: 100,
      selectedSlots: [requestSlot],
    }),
    "PENDING_REQUEST_EXISTS",
  );
  fixture.repository.findPendingRequest = async () => null;
  fixture.repository.findSlotConflict = async () => ({ _id: "occupied" });
  await rejectsWithCode(
    fixture.service.sendConnectRequest("mentee", {
      mentorId: "mentor",
      sessionRate: 100,
      selectedSlots: [requestSlot],
    }),
    "SLOT_TAKEN",
  );
});

test("send request uses profile rate and handles missing identity contact data", async () => {
  const fixture = customService({
    identityClient: { getUserSummaries: async () => [] },
    profileClient: { getMentorProfile: async () => ({ hourlyRate: 120 }) },
  });
  const result = await fixture.service.sendConnectRequest("mentee-1", {
    mentorId: "mentor-1",
    selectedSlots: [requestSlot],
    message: " hello ",
  });
  assert.equal(result.message, "hello");
  assert.equal(result.sessionRate, 120);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.realtime[0][2].message, "Mentee sent you a connect request.");

  const invalid = customService({
    profileClient: { getMentorProfile: async () => null },
  });
  await rejectsWithCode(
    invalid.service.sendConnectRequest("mentee-1", {
      mentorId: "mentor-1",
      selectedSlots: [requestSlot],
    }),
    "INVALID_SESSION_RATE",
  );
});

test("request response rejects invalid states and missing race results", async () => {
  const fixture = customService();
  await rejectsWithCode(
    fixture.service.respondToRequest("request-1", "mentor-1", {}),
    "INVALID_REQUEST_STATUS",
  );
  await rejectsWithCode(
    fixture.service.respondToRequest("request-1", "mentor-1", {
      status: "accepted",
      confirmedSlot: {},
    }),
    "INVALID_SLOT",
  );
  fixture.repository.findSlotConflict = async () => ({ _id: "different" });
  await rejectsWithCode(
    fixture.service.respondToRequest("request-1", "mentor-1", {
      status: "accepted",
      confirmedSlot: requestSlot,
    }),
    "SLOT_TAKEN",
  );
  fixture.repository.findSlotConflict = async () => null;
  fixture.repository.findById = async () => null;
  await rejectsWithCode(
    fixture.service.respondToRequest("request-1", "mentor-1", { status: "rejected" }),
    "REQUEST_NOT_FOUND",
  );
  fixture.repository.findById = async () => fixture.request;
  fixture.repository.updatePendingResponse = async () => null;
  await rejectsWithCode(
    fixture.service.respondToRequest("request-1", "mentor-1", { status: "rejected" }),
    "REQUEST_NOT_FOUND",
  );
});

test("request acceptance validates profile rate and selected session count", async () => {
  const missingRate = customService({
    repository: {
      findById: async () => ({ ...customService().request, sessionRate: null }),
    },
    profileClient: { getMentorProfile: async () => ({}) },
  });
  await rejectsWithCode(
    missingRate.service.respondToRequest("request-1", "mentor-1", {
      status: "accepted",
      confirmedSlot: requestSlot,
    }),
    "INVALID_SESSION_RATE",
  );
  const missingCount = customService({
    repository: {
      findById: async () => ({
        ...customService().request,
        sessionCount: 0,
        selectedSlots: [],
      }),
    },
    profileClient: { getMentorProfile: async () => ({ hourlyRate: 100 }) },
  });
  await rejectsWithCode(
    missingCount.service.respondToRequest("request-1", "mentor-1", {
      status: "accepted",
      confirmedSlot: requestSlot,
    }),
    "INVALID_SESSION_COUNT",
  );
});

test("cancel, detail, alternatives, and referrals enforce access and state rules", async () => {
  const fixture = customService();
  fixture.repository.findById = async () => null;
  await rejectsWithCode(fixture.service.cancelRequest("missing", "mentee-1"), "REQUEST_NOT_FOUND");
  await rejectsWithCode(fixture.service.getConnectDetail("missing", "mentee-1"), "REQUEST_NOT_FOUND");
  await rejectsWithCode(fixture.service.getSimilarMentors("missing", "mentor-1"), "REQUEST_NOT_FOUND");
  await rejectsWithCode(
    fixture.service.referRequest("request-1", "mentor-1", { referToMentorId: "mentor-2" }),
    "REQUEST_NOT_FOUND",
  );
  fixture.repository.findById = async () => fixture.request;
  await rejectsWithCode(fixture.service.cancelRequest("request-1", "other"), "NOT_REQUEST_OWNER");
  await rejectsWithCode(fixture.service.getConnectDetail("request-1", "other"), "NOT_REQUEST_PARTICIPANT");
  await rejectsWithCode(fixture.service.getSimilarMentors("request-1", "mentee-1"), "NOT_REQUEST_PARTICIPANT");
  await rejectsWithCode(
    fixture.service.referRequest("request-1", "other", { referToMentorId: "mentor-2" }),
    "NOT_REQUEST_OWNER",
  );
  fixture.request.status = "completed";
  await rejectsWithCode(fixture.service.cancelRequest("request-1", "mentee-1"), "REQUEST_NOT_CANCELLABLE");
  await rejectsWithCode(
    fixture.service.referRequest("request-1", "mentor-1", { referToMentorId: "mentor-2" }),
    "REQUEST_NOT_PENDING",
  );
});

test("referral validates target conflicts and concurrent status updates", async () => {
  const fixture = customService();
  const referral = (mentorId) =>
    fixture.service.referRequest("request-1", "mentor-1", { referToMentorId: mentorId });
  await rejectsWithCode(referral(undefined), "MENTOR_REQUIRED");
  await rejectsWithCode(referral("mentor-1"), "SELF_REFERRAL");
  fixture.repository.findPendingRequest = async () => ({ _id: "duplicate" });
  await rejectsWithCode(referral("mentor-2"), "PENDING_REQUEST_EXISTS");
  fixture.repository.findPendingRequest = async () => null;
  fixture.repository.markReferred = async () => null;
  await rejectsWithCode(referral("mentor-2"), "REQUEST_NOT_PENDING");
});

test("referral creates a new request and notifies both participants", async () => {
  const identity = {
    "mentee-1": { _id: "mentee-1", name: "Mentee", email: "mentee@example.com" },
    "mentor-1": { _id: "mentor-1", name: "Mentor" },
    "mentor-2": { _id: "mentor-2", name: "New Mentor", email: "new@example.com" },
  };
  const fixture = customService({
    identityClient: { getUserSummaries: async (ids) => ids.map((id) => identity[id]) },
  });
  const result = await fixture.service.referRequest(
    "request-1",
    "mentor-1",
    { referToMentorId: "mentor-2" },
    "corr-refer",
  );
  assert.equal(result.originalRequest.status, "referred");
  assert.equal(result.newRequest.mentor._id, "mentor-2");
  assert.equal(fixture.events.length, 3);
  assert.equal(fixture.events[0].type, "connect_request_referred");
  assert.equal(fixture.events[2].eventType, "connect.request.received.email");
  assert.equal(fixture.realtime.length, 4);
});
