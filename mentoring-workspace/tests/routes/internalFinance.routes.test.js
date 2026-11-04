const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalFinanceRouter = require("../../routes/internalFinance.routes");
const createInternalReminderRouter = require("../../routes/internalReminder.routes");

test("finance and reminder source APIs require the Workspace service token", async () => {
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      internalServiceAuth: createInternalServiceAuth({
        serviceToken: "workspace-token",
      }),
      internalFinanceRouter: createInternalFinanceRouter({
        controller: {
          getInvoiceContext: (_req, res) =>
            res.json({ data: { requestId: "request-1" } }),
          getMentorSessions: (_req, res) =>
            res.json({ data: { sessions: [] } }),
          getPayouts: (_req, res) => res.json({ data: { payouts: [] } }),
          getMentorRating: (_req, res) => res.json({ data: { avgRating: 4 } }),
          queueInvoiceEmail: (_req, res) =>
            res.status(202).json({ data: { accepted: true } }),
          queueEmailEvent: (_req, res) =>
            res.status(202).json({ data: { accepted: true } }),
        },
      }),
      internalReminderRouter: createInternalReminderRouter({
        controller: {
          listUpcomingSessions: (_req, res) =>
            res.json({ data: { sessions: [] } }),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(
      `${baseUrl}/internal/v1/reminders/upcoming-sessions`,
    );
    const authorized = await fetch(
      `${baseUrl}/internal/v1/finance/invoices/request-1`,
      {
        headers: { Authorization: "Bearer workspace-token" },
      },
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
    const queued = await fetch(`${baseUrl}/internal/v1/finance/invoice-email`, {
      method: "POST",
      headers: {
        Authorization: "Bearer workspace-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourceEventId: "payment-invoice:1" }),
    });
    assert.equal(queued.status, 202);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
