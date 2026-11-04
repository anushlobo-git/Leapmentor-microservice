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

test("Payments client validates its client and provision wallet payload", async () => {
  assert.throws(() => createPaymentsClient({}), /payments HTTP client is required/);

  const client = createPaymentsClient({ httpClient: { request: async () => ({}) } });
  assert.throws(
    () => client.provisionWallet({ roles: ["mentee"], idempotencyKey: "key" }),
    /userId is required/,
  );
  assert.throws(
    () => client.provisionWallet({ userId: "user-1", roles: [], idempotencyKey: "key" }),
    /At least one role is required/,
  );
  assert.throws(
    () => client.provisionWallet({ userId: "user-1", roles: ["mentee"] }),
    /idempotencyKey is required/,
  );
});

test("internal HTTP client handles optional auth, idempotency, empty and plain-text responses", async () => {
  let requestOptions;
  const client = createInternalHttpClient({
    baseUrl: "http://payments.test",
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(
    await client.request({ method: "POST", path: "/empty", correlationId: "" }),
    null,
  );
  assert.equal(requestOptions.headers.Authorization, undefined);
  assert.equal(requestOptions.headers["Idempotency-Key"], undefined);
  assert.equal(requestOptions.headers["X-Correlation-ID"], "not-provided");
  assert.equal(requestOptions.body, undefined);

  const idempotentClient = createInternalHttpClient({
    baseUrl: "http://payments.test",
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return new Response("plain text", { status: 200 });
    },
  });
  assert.deepEqual(
    await idempotentClient.request({
      method: "POST",
      path: "/wallet",
      body: { userId: "user-1" },
      idempotencyKey: "wallet-key",
    }),
    { message: "plain text" },
  );
  assert.equal(requestOptions.headers["Idempotency-Key"], "wallet-key");
  assert.deepEqual(JSON.parse(requestOptions.body), { userId: "user-1" });
});
