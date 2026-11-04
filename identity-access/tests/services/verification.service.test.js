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
  assert.match(fakes.sentEmails[0].html, /Verify your LeapMentor account/);
  assert.match(fakes.sentEmails[0].html, /Option 1 — Magic Link/);
  assert.match(fakes.sentEmails[0].html, /Option 2 — OTP/);
  assert.match(fakes.sentEmails[0].html, /#4F46E5/);
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

test("verification initiation rejects missing email, unknown users, and already verified accounts", async () => {
  const fakes = createFakes();
  await assert.rejects(
    fakes.service.initiateVerification(""),
    (error) => error.code === "INVALID_EMAIL",
  );

  fakes.user.isEmailVerified = true;
  await assert.rejects(
    fakes.service.initiateVerification("user@example.com"),
    (error) => error.code === "EMAIL_ALREADY_VERIFIED",
  );

  const unknown = createFakes();
  unknown.service = createVerificationService({
    userRepository: { findUserByEmail: async () => null },
    verificationTokenRepository: {},
    bcrypt: {},
    sendEmail: async () => {},
    appBaseUrl: "https://app.example.com",
    fromEmail: "noreply@example.com",
  });
  await assert.rejects(
    unknown.service.initiateVerification("unknown@example.com"),
    (error) => error.code === "USER_NOT_FOUND",
  );
});

test("verification operations reject missing tokens, missing requests, and incorrect values", async () => {
  const fakes = createFakes();
  await assert.rejects(
    fakes.service.processOtpVerification("", "123456"),
    (error) => error.code === "INVALID_VERIFICATION_INPUT",
  );
  await assert.rejects(
    fakes.service.processLinkVerification("token", ""),
    (error) => error.code === "INVALID_VERIFICATION_INPUT",
  );

  fakes.tokenRecords.length = 0;
  await assert.rejects(
    fakes.service.processOtpVerification("user@example.com", "123456"),
    (error) => error.code === "VERIFICATION_NOT_FOUND",
  );

  await fakes.service.initiateVerification("user@example.com");
  await assert.rejects(
    fakes.service.processOtpVerification("user@example.com", "000000"),
    (error) => error.code === "INVALID_VERIFICATION_CODE",
  );
  await assert.rejects(
    fakes.service.processLinkVerification("wrong-token", "user@example.com"),
    (error) => error.code === "INVALID_VERIFICATION_CODE",
  );
});

test("magic-link verification chooses a supported role and handles users without roles", async () => {
  const mentee = createFakes();
  mentee.user.roles = ["other", "mentee", "mentor"];
  await mentee.service.initiateVerification("user@example.com");
  assert.deepEqual(
    await mentee.service.processLinkVerification("plain-token", "user@example.com"),
    { role: "mentor" },
  );

  const roleless = createFakes();
  roleless.user.roles = [];
  await roleless.service.initiateVerification("user@example.com");
  assert.deepEqual(
    await roleless.service.processLinkVerification("plain-token", "user@example.com"),
    { role: null },
  );
});
