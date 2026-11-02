const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_NAME = "Test Admin";
process.env.ADMIN_EMAIL = "test-admin@example.com";
process.env.ADMIN_PASSWORD = "not-a-real-password";

const { seedAdmin, validateAdmin } = require("../../scripts/seedAdmin");

test("admin seed validates required configuration", () => {
  assert.doesNotThrow(validateAdmin);
});

test("admin seed leaves an existing administrator unchanged", async () => {
  const calls = [];
  const result = await seedAdmin({
    adminModel: {
      findOne: async (filter) => {
        calls.push(["findOne", filter]);
        return { _id: "existing-admin" };
      },
      create: async () => {
        calls.push(["create"]);
      },
    },
  });

  assert.deepEqual(result, { inserted: false, email: "test-admin@example.com" });
  assert.deepEqual(calls, [
    ["findOne", { email: "test-admin@example.com" }],
  ]);
});

test("admin seed creates a super administrator only when one does not exist", async () => {
  let created;
  const result = await seedAdmin({
    adminModel: {
      findOne: async () => null,
      create: async (admin) => {
        created = admin;
      },
    },
  });

  assert.deepEqual(result, { inserted: true, email: "test-admin@example.com" });
  assert.deepEqual(created, {
    name: "Test Admin",
    email: "test-admin@example.com",
    password: "not-a-real-password",
    isSuperAdmin: true,
  });
});
