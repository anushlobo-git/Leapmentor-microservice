const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionReminderService = require("../../services/sessionReminder.service");

test("sends 1-hour reminders to both participants with stable source event IDs", async () => {
  const events = [];
  const service = createSessionReminderService({
    workspaceClient: {
      isConfigured: () => true,
      listUpcomingSessions: async () => [
        {
          requestId: "request-1",
          mentee: { _id: "mentee-1", name: "Mentee" },
          mentor: { _id: "mentor-1", name: "Mentor" },
          confirmedSlot: { date: "2026-10-28", startTime: "07:00" },
        },
      ],
    },
    notificationService: {
      createFromEvent: async (event) => events.push(event),
    },
    now: () => new Date("2026-10-28T00:30:00.000Z"),
  });

  const result = await service.runOnce();
  assert.deepEqual(result, { scanned: 1, delivered: 2 });
  assert.deepEqual(
    events.map((event) => event.sourceEventId),
    [
      "session-reminder:request-1:1h:mentee-1",
      "session-reminder:request-1:1h:mentor-1",
    ],
  );
  assert.equal(events[0].type, "upcoming_session");
});

test("skips reminder scans until the Workspace client is configured", async () => {
  const service = createSessionReminderService({
    workspaceClient: {
      isConfigured: () => false,
      listUpcomingSessions: async () => assert.fail(),
    },
    notificationService: { createFromEvent: async () => assert.fail() },
  });
  assert.deepEqual(await service.runOnce(), {
    skipped: true,
    reason: "workspace-client-not-configured",
  });
});
