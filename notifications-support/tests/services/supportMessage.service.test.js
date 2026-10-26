const test = require("node:test");
const assert = require("node:assert/strict");

const createSupportMessageService = require("../../services/supportMessage.service");

test("submits a public support ticket with an optional authenticated user", async () => {
  const created = [];
  const service = createSupportMessageService({
    supportMessageRepository: { create: async (ticket) => { created.push(ticket); return { _id: "ticket-1", ...ticket }; } },
  });
  const result = await service.submitTicket({ email: "USER@example.com", subject: "Help", message: "I need help", role: "mentee", user: "user-1" });
  assert.equal(result._id, "ticket-1");
  assert.equal(created[0].email, "user@example.com");
  assert.equal(created[0].status, "open");
  assert.equal(created[0].user, "user-1");
});

test("resolves a ticket and emits an idempotent support notification for a known user", async () => {
  const events = [];
  const service = createSupportMessageService({
    supportMessageRepository: { updateStatusById: async () => ({ _id: "ticket-1", user: "user-1", email: "user@example.com", subject: "Help", status: "resolved" }) },
    notificationService: { createFromEvent: async (event) => events.push(event) },
  });
  const result = await service.resolveTicket("ticket-1");
  assert.equal(result.status, "resolved");
  assert.equal(events[0].type, "support_resolved");
  assert.equal(events[0].recipient, "user-1");
});

test("returns a stable not-found error when resolving an unknown ticket", async () => {
  const service = createSupportMessageService({ supportMessageRepository: { updateStatusById: async () => null } });
  await assert.rejects(service.resolveTicket("missing"), { statusCode: 404, code: "SUPPORT_TICKET_NOT_FOUND" });
});
