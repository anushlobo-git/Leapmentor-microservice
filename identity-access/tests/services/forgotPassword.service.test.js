const test = require("node:test");
const assert = require("node:assert/strict");

const createForgotPasswordService = require("../../services/forgotPassword.service");

const createFakes = ({ sendError = null, userExists = true } = {}) => {
  const user = {
    _id: "user-1",
    email: "user@example.com",
    password: "old-hash",
  };
  const records = [];
  const sentEmails = [];
  const savedUsers = [];
  const userRepository = {
    findUserByEmail: async () => (userExists ? user : null),
    saveUser: async (record) => {
      savedUsers.push({ ...record });
      return record;
    },
  };
  const verificationTokenRepository = {
    deleteTokensByUserId: async (userId) => {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index].user === userId) records.splice(index, 1);
      }
    },
    createToken: async (record) => {
      records.push(record);
      return record;
    },
    findTokenByUserId: async (userId) =>
      records.find((record) => record.user === userId) || null,
    saveToken: async (record) => record,
  };
  const bcrypt = {
    hash: async (value) => `hash:${value}`,
    compare: async (value, hash) => `hash:${value}` === hash,
  };
  const sendEmail = async (message) => {
    sentEmails.push(message);
    if (sendError) throw sendError;
  };
  const service = createForgotPasswordService({
    userRepository,
    verificationTokenRepository,
    bcrypt,
    sendEmail,
    fromEmail: "noreply@example.com",
    now: () => new Date("2026-10-24T12:00:00.000Z"),
    generateOtp: () => "123456",
  });

  return { service, user, records, sentEmails, savedUsers };
};

test("sends a password reset OTP and stores only its hash", async () => {
  const fakes = createFakes();
  const result = await fakes.service.sendForgotPasswordOtp(" USER@example.com ");

  assert.equal(result.message, "If this email exists, an OTP has been sent.");
  assert.deepEqual(fakes.records[0], {
    user: "user-1",
    token: null,
    otp: "hash:123456",
    expiresAt: new Date("2026-10-24T12:10:00.000Z"),
  });
  assert.match(fakes.sentEmails[0].text, /123456/);
});

test("uses an ambiguous response for an unknown email", async () => {
  const fakes = createFakes({ userExists: false });

  const result = await fakes.service.sendForgotPasswordOtp("ghost@example.com");
  assert.equal(result.message, "If this email exists, an OTP has been sent.");
  assert.equal(fakes.records.length, 0);
  assert.equal(fakes.sentEmails.length, 0);
});

test("verifies a reset OTP and extends the short reset session", async () => {
  const fakes = createFakes();
  await fakes.service.sendForgotPasswordOtp("user@example.com");
  const result = await fakes.service.verifyResetOtp("user@example.com", "123456");

  assert.deepEqual(result, {
    message: "OTP verified",
    email: "user@example.com",
  });
  assert.equal(fakes.records[0].expiresAt.getTime(), new Date("2026-10-24T12:05:00.000Z").getTime());
});

test("resets the password and consumes the reset record", async () => {
  const fakes = createFakes();
  await fakes.service.sendForgotPasswordOtp("user@example.com");
  await fakes.service.resetPassword({
    email: "user@example.com",
    otp: "123456",
    newPassword: "newpass123",
  });

  assert.equal(fakes.savedUsers[0].password, "hash:newpass123");
  assert.equal(fakes.savedUsers[0].passwordChangedAt.toISOString(), "2026-10-24T12:00:00.000Z");
  assert.equal(fakes.records.length, 0);
});

test("cleans up the OTP when reset email delivery fails", async () => {
  const fakes = createFakes({
    sendError: Object.assign(new Error("SMTP unavailable"), {
      code: "EMAIL_DELIVERY_NOT_CONFIGURED",
    }),
  });

  await assert.rejects(
    () => fakes.service.sendForgotPasswordOtp("user@example.com"),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "EMAIL_DELIVERY_NOT_CONFIGURED");
      return true;
    },
  );
  assert.equal(fakes.records.length, 0);
});
