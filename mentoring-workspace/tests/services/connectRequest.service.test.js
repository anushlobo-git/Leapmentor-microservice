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
