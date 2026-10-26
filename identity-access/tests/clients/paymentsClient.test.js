const test = require("node:test");
const assert = require("node:assert/strict");

const createInternalHttpClient = require("../../clients/internalHttpClient");
const createPaymentsClient = require("../../clients/paymentsClient");

test("provisionWallet sends the wallet contract with tracing and idempotency headers", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({ provisioningStatus: "complete" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  };

  const httpClient = createInternalHttpClient({
    baseUrl: "http://payments.test",
    serviceToken: "payments-token",
    fetchImpl,
  });
  const paymentsClient = createPaymentsClient({ httpClient });

  const result = await paymentsClient.provisionWallet({
    userId: "user-123",
    roles: ["mentee"],
    idempotencyKey: "wallet-user-123",
    correlationId: "corr-123",
  });

  assert.deepEqual(result, { provisioningStatus: "complete" });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "http://payments.test/internal/v1/wallets/provision",
  );
  assert.equal(calls[0].options.headers.Authorization, "Bearer payments-token");
  assert.equal(calls[0].options.headers["X-Correlation-ID"], "corr-123");
  assert.equal(calls[0].options.headers["Idempotency-Key"], "wallet-user-123");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    userId: "user-123",
    roles: ["mentee"],
  });
});

test("the internal HTTP client exposes the owner's failure status", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ message: "wallet unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

  const httpClient = createInternalHttpClient({
    baseUrl: "http://payments.test",
    fetchImpl,
  });

  await assert.rejects(
    () =>
      httpClient.request({
        method: "GET",
        path: "/internal/v1/health",
      }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, "wallet unavailable");
      return true;
    },
  );
});
