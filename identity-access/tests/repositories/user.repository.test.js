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
  query.skip = (...args) => {
    query.skipped = args;
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

test("user repository supports credential lookup, email lookup, create, save, role and wallet updates", async () => {
  const calls = [];
  const queries = [];
  const User = {
    findOne: (filter) => {
      calls.push(["findOne", filter]);
      const query = createQuery({ _id: "user-1" });
      queries.push(query);
      return query;
    },
    create: async (data) => {
      calls.push(["create", data]);
      return { _id: "user-1", ...data };
    },
    findByIdAndUpdate: (id, update, options) => {
      calls.push(["findByIdAndUpdate", id, update, options]);
      const query = createQuery({ _id: id });
      queries.push(query);
      return query;
    },
  };
  const repository = createUserRepository(User);
  const user = { _id: "user-1", save: async () => "saved" };

  assert.deepEqual(await repository.findUserByEmailWithPassword("a@example.com"), { _id: "user-1" });
  assert.deepEqual(queries[0].selected, ["+password"]);
  assert.deepEqual(await repository.findUserByEmail("a@example.com"), { _id: "user-1" });
  assert.deepEqual(await repository.createUser({ email: "a@example.com" }), {
    _id: "user-1",
    email: "a@example.com",
  });
  assert.equal(await repository.saveUser(user), "saved");
  assert.deepEqual(await repository.addRoleToUser("user-1", "mentor"), { _id: "user-1" });
  assert.deepEqual(calls.at(-1), [
    "findByIdAndUpdate",
    "user-1",
    { $addToSet: { roles: "mentor" } },
    { new: true, runValidators: true },
  ]);
  assert.deepEqual(await repository.updateWalletProvisioningStatus("user-1", "failed", "offline"), {
    _id: "user-1",
  });
  assert.equal(calls.at(-1)[2].$set.walletProvisioningStatus, "failed");
  assert.equal(calls.at(-1)[2].$set.walletProvisioningError, "offline");
  assert.ok(calls.at(-1)[2].$set.walletProvisioningUpdatedAt instanceof Date);
});

test("Admin user repository builds filters, pagination, status updates, counts, and growth queries", async () => {
  const queries = [];
  const calls = [];
  const User = {
    find: (filter) => {
      calls.push(["find", filter]);
      const query = createQuery([{ _id: "user-1" }]);
      queries.push(query);
      return query;
    },
    countDocuments: (filter) => {
      calls.push(["countDocuments", filter]);
      const query = createQuery(5);
      queries.push(query);
      return query;
    },
    findById: (id) => {
      calls.push(["findById", id]);
      const query = createQuery({ _id: id });
      queries.push(query);
      return query;
    },
    findByIdAndUpdate: (id, update, options) => {
      calls.push(["findByIdAndUpdate", id, update, options]);
      const query = createQuery({ _id: id });
      queries.push(query);
      return query;
    },
    aggregate: (pipeline) => {
      calls.push(["aggregate", pipeline]);
      return [{ _id: "2026-01-01", count: 2 }];
    },
  };
  const repository = createUserRepository(User);

  const result = await repository.findAdminUsers({
    search: "  a.*@example.com ",
    role: "mentor",
    page: "2",
    limit: "10",
    deleted: "true",
  });
  assert.deepEqual(result, {
    users: [{ _id: "user-1" }],
    pagination: { total: 5, page: 2, limit: 10, totalPages: 1 },
  });
  assert.deepEqual(calls[0][1].isDeleted, true);
  assert.deepEqual(calls[0][1].roles, "mentor");
  assert.equal(calls[0][1].$or[0].name.$regex.test("a.*@example.com"), true);
  assert.deepEqual(queries[0].options, [{ ignoreIsDeleted: true }]);
  assert.deepEqual(queries[0].sorted, [{ createdAt: -1 }]);
  assert.deepEqual(queries[0].skipped, [10]);
  assert.deepEqual(queries[0].limited, [10]);
  assert.deepEqual(queries[1].options, [{ ignoreIsDeleted: true }]);

  await repository.findAdminUsers({});
  assert.deepEqual(calls[2][1], { isDeleted: { $ne: true } });
  assert.deepEqual(await repository.findAdminUserById("user-2"), { _id: "user-2" });
  assert.deepEqual(queries.at(-1).options, [{ ignoreIsDeleted: true }]);

  await repository.updateAdminUserDeletedState("user-3", false);
  const updateCall = calls.at(-1);
  assert.equal(updateCall[2].$set.isDeleted, false);
  assert.equal(updateCall[2].$set.deletedAt, null);
  assert.deepEqual(updateCall[3], { returnDocument: "after", runValidators: true });

  await repository.updateAdminUserDeletedState("user-3", true);
  assert.equal(calls.at(-1)[2].$set.isDeleted, true);
  assert.ok(calls.at(-1)[2].$set.deletedAt instanceof Date);

  assert.equal(await repository.countAdminUsers({ roles: "mentor" }), 5);
  assert.deepEqual(calls.at(-1)[1], { isDeleted: { $ne: true }, roles: "mentor" });
  assert.deepEqual(await repository.getAdminUserGrowth(new Date("2026-01-01")), [
    { _id: "2026-01-01", count: 2 },
  ]);
  assert.equal(calls.at(-1)[0], "aggregate");
});
