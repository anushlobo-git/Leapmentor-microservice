const test = require("node:test");
const assert = require("node:assert/strict");

const createUserService = require("../../services/user.service");

test("maps the authenticated account to the public current-user DTO", () => {
  const service = createUserService();
  const result = service.getCurrentUser({
    _id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    password: "must-not-leak",
    roles: ["mentor"],
    isEmailVerified: true,
    termsAccepted: true,
    termsAcceptedAt: "2026-10-24T00:00:00.000Z",
    walletProvisioningStatus: "complete",
  });

  assert.deepEqual(result, {
    _id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    roles: ["mentor"],
    isEmailVerified: true,
    termsAccepted: true,
    termsAcceptedAt: "2026-10-24T00:00:00.000Z",
    passwordChangedAt: null,
    isDeleted: false,
    deletedAt: null,
    walletProvisioningStatus: "complete",
    createdAt: undefined,
    updatedAt: undefined,
  });
  assert.equal(result.password, undefined);
});
