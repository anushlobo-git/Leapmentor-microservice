const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalEmailRouter = require("../../routes/internalEmail.routes");

test("report email command requires the Workspace service token", async () => {
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      internalServiceAuth: createInternalServiceAuth({
        serviceToken: "workspace-token",
      }),
      internalEmailRouter: createInternalEmailRouter({
        controller: {
          sendReportEvent: (_req, res) =>
            res.status(202).json({ data: { accepted: true } }),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const unauthorized = await fetch(
      `${baseUrl}/internal/v1/email-events/report-events`,
      { method: "POST" },
    );
    const authorized = await fetch(
      `${baseUrl}/internal/v1/email-events/report-events`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer workspace-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventType: "report.submitted.email" }),
      },
    );
    const invoiceAuthorized = await fetch(
      `${baseUrl}/internal/v1/email-events/invoice-events`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer workspace-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventType: "payment.invoice.email" }),
      },
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 202);
    assert.equal(invoiceAuthorized.status, 202);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
