const test = require("node:test");
const assert = require("node:assert/strict");

const createUserRepository = require("../../repositories/user.repository");

const createQuery = (value) => {
  const query = Promise.resolve(value);
  query.select = (...args) => {
    query.selected = args;
    return query;
  };
  query.setOptions = (...args) => {
    query.options = args;
    return query;
  };
  query.sort = (...args) => {
    query.sorted = args;
    return query;
  };
  query.limit = (...args) => {
    query.limited = args;
    return query;
  };
  query.lean = () => query;
  return query;
};

test("authentication lookup returns a password-free user and bypasses the soft-delete query hook", async () => {
  const query = createQuery({ _id: "user-1", roles: ["mentee"] });
  const User = {
    findById: (userId) => {
      assert.equal(userId, "user-1");
      return query;
    },
  };
  const repository = createUserRepository(User);

  const result = await repository.findUserByIdForAuthentication("user-1");

  assert.deepEqual(result, { _id: "user-1", roles: ["mentee"] });
  assert.deepEqual(query.selected, ["-password"]);
  assert.deepEqual(query.options, [{ ignoreIsDeleted: true }]);
});

test("current-user lookup excludes password fields from the normal profile read", async () => {
  const query = createQuery({ _id: "user-2", email: "user@example.com" });
  const User = {
    findById: () => query,
  };
  const repository = createUserRepository(User);

  const result = await repository.findUserById("user-2");

  assert.deepEqual(result, { _id: "user-2", email: "user@example.com" });
  assert.deepEqual(query.selected, ["-password"]);
});

test("internal user lookups can batch ids without exposing passwords", async () => {
  const query = createQuery([{ _id: "user-3", name: "Ada" }]);
  const User = {
    find: (filter) => {
      assert.deepEqual(filter, { _id: { $in: ["user-3", "user-4"] } });
      return query;
    },
  };
  const repository = createUserRepository(User);

  const result = await repository.findUsersByIds(["user-3", "user-4"]);

  assert.deepEqual(result, [{ _id: "user-3", name: "Ada" }]);
  assert.deepEqual(query.selected, ["name email roles isEmailVerified"]);
  assert.deepEqual(query.sorted, [{ name: 1 }]);
  assert.deepEqual(query.limited, undefined);
});

test("internal user search combines a case-insensitive name match with roles", async () => {
  const query = createQuery([{ _id: "user-5", name: "Grace" }]);
  const User = {
    find: (filter) => {
      assert.deepEqual(filter, {
        roles: { $in: ["mentor"] },
        name: { $regex: /grace/i },
      });
      return query;
    },
  };
  const repository = createUserRepository(User);

  const result = await repository.findUsersByRoleAndNameRegex("grace", ["mentor"]);

  assert.deepEqual(result, [{ _id: "user-5", name: "Grace" }]);
  assert.deepEqual(query.limited, [50]);
});
