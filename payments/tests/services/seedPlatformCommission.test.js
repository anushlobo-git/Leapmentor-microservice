const test = require("node:test");
const assert = require("node:assert/strict");

const seedPlatformCommission = require("../../scripts/seedPlatformCommission");

test("seeds the configured commission only when no value exists", async () => {
  const calls = [];
  const result = await seedPlatformCommission({
    defaultRate: 18,
    settingModel: {
      updateOne: async (...args) => { calls.push(args); return { upsertedCount: 1 }; },
    },
  });
  assert.deepEqual(result, { inserted: true, rate: 18 });
  assert.deepEqual(calls[0], [
    { key: "commissionRate" },
    { $setOnInsert: { key: "commissionRate", numberValue: 18 } },
    { upsert: true, runValidators: true },
  ]);
});

test("does not replace an existing commission and rejects invalid seed rates", async () => {
  const result = await seedPlatformCommission({
    defaultRate: 20,
    settingModel: { updateOne: async () => ({ upsertedCount: 0 }) },
  });
  assert.deepEqual(result, { inserted: false, rate: 20 });
  await assert.rejects(seedPlatformCommission({ defaultRate: 101, settingModel: {} }), /between 0 and 100/);
});