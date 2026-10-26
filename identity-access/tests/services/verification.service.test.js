const test = require("node:test");
const assert = require("node:assert/strict");

const createVerificationService = require("../../services/verification.service");

const createFakes = ({ sendError = null } = {}) => {
  const user = {
    _id: "user-1",
    email: "user@example.com",
    roles: ["mentor"],
    isEmailVerified: false,
  };
  const tokenRecords = [];
  const sentEmails = [];
  const savedUsers = [];

  const userRepository = {
    findUserByEmail: async () => user,
    saveUser: async (record) => {
      savedUsers.push(record);
      return record;
    },
  };
  const verificationTokenRepository = {
    deleteTokensByUserId: async (userId) => {
      for (let index = tokenRecords.length - 1; index >= 0; index -= 1) {
        if (tokenRecords[index].user === userId) tokenRecords.splice(index, 1);
      }
    },
    createToken: async (record) => {
      tokenRecords.push(record);
      return record;
    },
    findTokenByUserId: async (userId) =>
      tokenRecords.find((record) => record.user === userId) || null,
  };
  const bcrypt = {
    hash: async (value) => `hash:${value}`,
    compare: async (value, hash) => `hash:${value}` === hash,
  };
  const sendEmail = async (message) => {
    sentEmails.push(message);
    if (sendError) throw sendError;
  };

  const service = createVerificationService({
    userRepository,
    verificationTokenRepository,
    bcrypt,
    sendEmail,
    appBaseUrl: "https://app.example.com",
    fromEmail: "noreply@example.com",
    now: () => new Date("2026-10-24T12:00:00.000Z"),
    generateOtp: () => "123456",
    generateToken: () => "plain-token",
  });

  return { service, user, tokenRecords, sentEmails, savedUsers };
};

test("sends an OTP and magic link while storing only hashes", async () => {
  const fakes = createFakes();
  await fakes.service.initiateVerification(" USER@example.com ", " - Registration");

  assert.equal(fakes.tokenRecords.length, 1);
  assert.deepEqual(fakes.tokenRecords[0], {
    user: "user-1",
    otp: "hash:123456",
    token: "hash:plain-token",
    expiresAt: new Date("2026-10-24T12:10:00.000Z"),
  });
  assert.equal(fakes.sentEmails.length, 1);
  assert.equal(fakes.sentEmails[0].to, "user@example.com");
  assert.match(fakes.sentEmails[0].text, /123456/);
  assert.match(fakes.sentEmails[0].text, /plain-token/);
  assert.equal(fakes.sentEmails[0].subject, "LeapMentor Email Verification - Registration");
});

test("verifies a valid OTP, saves the user, and deletes the token", async () => {
  const fakes = createFakes();
  await fakes.service.initiateVerification("user@example.com");
  await fakes.service.processOtpVerification("user@example.com", "123456");

  assert.equal(fakes.user.isEmailVerified, true);
  assert.equal(fakes.savedUsers.length, 1);
  assert.equal(fakes.tokenRecords.length, 0);
});

test("verifies a valid magic link and returns the user's primary role", async () => {
  const fakes = createFakes();
  await fakes.service.initiateVerification("user@example.com");
  const result = await fakes.service.processLinkVerification(
    "plain-token",
    "user@example.com",
  );

  assert.deepEqual(result, { role: "mentor" });
  assert.equal(fakes.user.isEmailVerified, true);
});

test("deletes expired tokens and rejects expired OTPs", async () => {
  const fakes = createFakes();
  await fakes.service.initiateVerification("user@example.com");
  fakes.tokenRecords[0].expiresAt = new Date("2026-10-24T11:59:00.000Z");

  await assert.rejects(
    () => fakes.service.processOtpVerification("user@example.com", "123456"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VERIFICATION_EXPIRED");
      return true;
    },
  );
  assert.equal(fakes.tokenRecords.length, 0);
});

test("does not leave a token when email delivery is unavailable", async () => {
  const fakes = createFakes({
    sendError: Object.assign(new Error("SMTP unavailable"), {
      code: "EMAIL_DELIVERY_NOT_CONFIGURED",
    }),
  });

  await assert.rejects(
    () => fakes.service.initiateVerification("user@example.com"),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "EMAIL_DELIVERY_NOT_CONFIGURED");
      return true;
    },
  );
  assert.equal(fakes.tokenRecords.length, 0);
});
