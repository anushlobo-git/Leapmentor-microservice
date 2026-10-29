const test = require("node:test");
const assert = require("node:assert/strict");

const createEarningsController = require("../../controllers/earnings.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("withdraw endpoint creates a fallback idempotency key when absent", async () => {
  let receivedKey;
  const controller = createEarningsController({
    earningsService: {
      withdrawEarningsService: async (_userId, idempotencyKey) => {
        receivedKey = idempotencyKey;
        return { withdrawn: 10, newBalance: 0 };
      },
    },
  });
  const res = response();

  await controller.withdrawEarnings(
    { user: { _id: "mentor-1" }, get: () => undefined },
    res,
    assert.fail,
  );

  assert.equal(res.statusCode, 200);
  assert.match(receivedKey, /^earnings-withdrawal:mentor-1:[0-9a-f-]{36}$/);
});

test("withdraw endpoint preserves a supplied idempotency key", async () => {
  let receivedKey;
  const controller = createEarningsController({
    earningsService: {
      withdrawEarningsService: async (_userId, idempotencyKey) => {
        receivedKey = idempotencyKey;
        return { withdrawn: 10, newBalance: 0 };
      },
    },
  });

  await controller.withdrawEarnings(
    {
      user: { _id: "mentor-1" },
      get: () => "client-provided-key",
    },
    response(),
    assert.fail,
  );

  assert.equal(receivedKey, "client-provided-key");
});
