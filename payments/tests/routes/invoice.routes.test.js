const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInvoiceRouter = require("../../routes/invoice.routes");

test("rejects malformed invoice IDs before invoking the controller", async () => {
  let called = false;
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      invoiceRouter: createInvoiceRouter({
        authenticate: (_req, _res, next) => next(),
        controller: {
          downloadInvoice: (_req, res) => {
            called = true;
            res.send("pdf");
          },
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/invoices/not-an-id`,
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_CONNECT_REQUEST_ID");
    assert.equal(called, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
