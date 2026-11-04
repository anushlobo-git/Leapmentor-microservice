const test = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../../utils/AppError");
const { toAdminDTO } = require("../../utils/admin.mapper");
const createTtlCache = require("../../utils/ttlCache");

test("AppError preserves status and code defaults", () => {
  const defaultError = new AppError("failure");
  assert.equal(defaultError.name, "AppError");
  assert.equal(defaultError.statusCode, 500);
  assert.equal(defaultError.code, "APP_ERROR");

  const customError = new AppError("invalid", 422, "INVALID");
  assert.equal(customError.statusCode, 422);
  assert.equal(customError.code, "INVALID");
});

test("admin DTO stringifies document IDs and returns the supported admin fields", () => {
  const dto = toAdminDTO({
    _id: { toString: () => "admin-1" },
    name: "Ada",
    email: "ada@example.com",
    isSuperAdmin: true,
    isActive: true,
    lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
    tokenVersion: 4,
  });
  assert.deepEqual(dto, {
    _id: "admin-1",
    name: "Ada",
    email: "ada@example.com",
    isSuperAdmin: true,
    isActive: true,
    lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
    commissionRate: undefined,
    walletBalance: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });
});

test("TTL cache reuses live values, expires them, and supports explicit clearing", async () => {
  const cache = createTtlCache();
  let calls = 0;
  const factory = async () => ++calls;

  assert.equal(await cache.getOrSet("stats", 1, factory), 1);
  assert.equal(await cache.getOrSet("stats", 1, factory), 1);
  assert.equal(calls, 1);
  cache.clear("stats");
  assert.equal(await cache.getOrSet("stats", 1, factory), 2);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await cache.getOrSet("short", 0.001, factory), 3);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(await cache.getOrSet("short", 1, factory), 4);
});
