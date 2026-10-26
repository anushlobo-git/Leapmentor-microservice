const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../../models/User");
const createUserRepository = require("../../repositories/user.repository");

test("the real Mongoose lookup hook excludes deleted accounts without a database", async (t) => {
  const queries = [];
  t.mock.method(User.collection, "findOne", async (filter) => {
    queries.push(filter);
    return null;
  });

  const repository = createUserRepository(User);
  assert.equal(await repository.findUserByEmailWithPassword("user@example.com"), null);
  assert.deepEqual(queries, [{
    email: "user@example.com",
    isDeleted: { $ne: true },
  }]);
});

test("legacy user hydration preserves passwordChangedAt without inventing pending wallet work", () => {
  const changedAt = new Date("2026-10-01T10:00:00.000Z");
  const user = User.hydrate({
    _id: "507f1f77bcf86cd799439011",
    name: "Existing User",
    email: "user@example.com",
    roles: ["mentee"],
    passwordChangedAt: changedAt,
  });
  assert.deepEqual(user.passwordChangedAt, changedAt);
  assert.equal(user.walletProvisioningStatus, "complete");
});
