const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const AdminUser = require("../../models/AdminUser");

test("AdminUser schema enforces credentials and hashes passwords before save", async () => {
  assert.equal(AdminUser.schema.path("name").isRequired, true);
  assert.equal(AdminUser.schema.path("email").isRequired, true);
  assert.equal(AdminUser.schema.path("password").options.select, false);

  const password = "StrongAdminPass1!";
  const admin = new AdminUser({
    name: "Ada",
    email: "ADA@example.com",
    password,
  });
  assert.equal(admin.email, "ada@example.com");
  const hook = AdminUser.schema.s.hooks._pres
    .get("save")
    .find(({ fn }) => fn.name === "hashPassword").fn;
  await hook.call(admin);
  assert.notEqual(admin.password, password);
  assert.equal(await bcrypt.compare(password, admin.password), true);

  admin.password = await bcrypt.hash(password, 4);
  assert.equal(await admin.comparePassword(password), true);
  assert.equal(await admin.comparePassword("wrong-password"), false);
});
