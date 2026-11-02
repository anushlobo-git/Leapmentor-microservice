const test = require("node:test");
const assert = require("node:assert/strict");

const createAdminUserRepository = require("../../repositories/adminUser.repository");

test("admin repository delegates model queries and mutations with expected options", async () => {
  const calls = [];
  const query = (result) => ({
    select(...args) {
      calls.push(["select", ...args]);
      return this;
    },
    lean() {
      calls.push(["lean"]);
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  });
  const model = {
    findOne: (filter) => {
      calls.push(["findOne", filter]);
      return query({ email: filter.email });
    },
    findById: (id) => {
      calls.push(["findById", id]);
      return query({ _id: id });
    },
    findByIdAndUpdate: (...args) => {
      calls.push(["findByIdAndUpdate", ...args]);
      return Promise.resolve({ _id: args[0] });
    },
    create: async (data) => {
      calls.push(["create", data]);
      return data;
    },
  };
  const repository = createAdminUserRepository(model);
  const admin = { save: async () => "saved" };

  assert.deepEqual(await repository.findAdminByEmail("ada@example.com"), {
    email: "ada@example.com",
  });
  assert.deepEqual(await repository.findAdminByIdLean("admin-1"), { _id: "admin-1" });
  assert.deepEqual(await repository.findAdminByIdFull("admin-2"), { _id: "admin-2" });
  assert.deepEqual(
    await repository.updateAdminById("admin-3", { isActive: false }),
    { _id: "admin-3" },
  );
  assert.deepEqual(await repository.createAdmin({ name: "Ada" }), { name: "Ada" });
  assert.equal(await repository.saveAdmin(admin), "saved");
  assert.deepEqual(await repository.incrementTokenVersion("admin-4"), { _id: "admin-4" });

  assert.deepEqual(calls[0], ["findOne", { email: "ada@example.com" }]);
  assert.ok(calls.some(([name, id, update, options]) =>
    name === "findByIdAndUpdate" &&
    id === "admin-3" &&
    update.$set.isActive === false &&
    options.returnDocument === "after" &&
    options.runValidators === true,
  ));
  assert.ok(calls.some(([name, id, update, options]) =>
    name === "findByIdAndUpdate" &&
    id === "admin-4" &&
    update.$inc.tokenVersion === 1 &&
    options.returnDocument === "after",
  ));
});
