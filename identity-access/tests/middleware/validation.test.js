const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sendForgotPasswordOtpValidation,
  verifyResetOtpValidation,
  resetPasswordValidation,
} = require("../../middleware/forgotPasswordValidation");
const {
  emailPayloadValidation,
  verifyOtpValidation,
  verifyLinkValidation,
} = require("../../middleware/verificationValidation");
const {
  googleValidation,
  linkedinValidation,
  socialValidation,
} = require("../../middleware/oauthValidation");
const { addRoleValidation } = require("../../middleware/userValidation");
const errorHandler = require("../../middleware/errorHandler");

const run = (middleware, req) => {
  let nextCalled = false;
  let error;
  middleware(req, {}, (value) => {
    nextCalled = true;
    error = value;
  });
  return { nextCalled, error };
};

test("forgot-password validation accepts complete payloads and rejects malformed fields", () => {
  assert.equal(
    run(sendForgotPasswordOtpValidation, { body: { email: "ada@example.com" } }).nextCalled,
    true,
  );
  assert.equal(
    run(verifyResetOtpValidation, {
      body: { email: "ada@example.com", otp: " 123456 " },
    }).nextCalled,
    true,
  );
  assert.equal(
    run(resetPasswordValidation, {
      body: { email: "ada@example.com", otp: "123456", newPassword: "secret1" },
    }).nextCalled,
    true,
  );

  for (const body of [{}, { email: "invalid" }, { email: 123 }]) {
    assert.equal(run(sendForgotPasswordOtpValidation, { body }).error.code, "VALIDATION_ERROR");
  }
  assert.match(
    run(verifyResetOtpValidation, { body: { email: "ada@example.com" } }).error.message,
    /OTP is required/,
  );
  assert.match(
    run(resetPasswordValidation, {
      body: { email: "ada@example.com", otp: "123456", newPassword: "short" },
    }).error.message,
    /at least 6 characters/,
  );
  assert.match(
    run(resetPasswordValidation, {
      body: { email: "ada@example.com", otp: "123456", newPassword: 123456 },
    }).error.message,
    /at least 6 characters/,
  );
});

test("email-verification validation covers email, OTP, and magic-link requirements", () => {
  assert.equal(
    run(emailPayloadValidation, { body: { email: "ada@example.com" } }).nextCalled,
    true,
  );
  assert.equal(
    run(verifyOtpValidation, { body: { email: "ada@example.com", otp: "123456" } }).nextCalled,
    true,
  );
  assert.equal(
    run(verifyLinkValidation, {
      query: { email: "ada@example.com" },
      params: { token: "signed-token" },
    }).nextCalled,
    true,
  );
  assert.equal(run(emailPayloadValidation, { body: {} }).error.statusCode, 400);
  assert.equal(
    run(verifyOtpValidation, { body: { email: "ada@example.com", otp: "12345" } }).error.code,
    "VALIDATION_ERROR",
  );
  assert.equal(
    run(verifyLinkValidation, {
      query: { email: "ada@example.com" },
      params: { token: " " },
    }).error.message,
    "Verification token is required.",
  );
});

test("OAuth validation accepts valid provider payloads and rejects invalid roles or terms", () => {
  assert.equal(
    run(googleValidation, { body: { credential: "credential" } }).nextCalled,
    true,
  );
  assert.equal(
    run(linkedinValidation, {
      body: { code: "authorization-code", roles: ["mentor"], termsAccepted: true },
    }).nextCalled,
    true,
  );
  assert.equal(
    run(socialValidation, {
      body: { provider: "google", providerId: "provider-id", roles: ["mentee"] },
    }).nextCalled,
    true,
  );

  for (const [middleware, body, code] of [
    [googleValidation, {}, "GOOGLE_CREDENTIAL_REQUIRED"],
    [linkedinValidation, {}, "LINKEDIN_CODE_REQUIRED"],
    [socialValidation, { provider: "google" }, "INVALID_SOCIAL_IDENTITY"],
    [googleValidation, { credential: "x", roles: [] }, "INVALID_ROLES"],
    [linkedinValidation, { code: "x", roles: "mentor" }, "INVALID_ROLES"],
    [socialValidation, { provider: "google", providerId: "x", roles: ["admin"] }, "INVALID_ROLE"],
  ]) {
    assert.equal(run(middleware, { body }).error.code, code);
  }
  assert.equal(
    run(googleValidation, { body: { credential: "x", termsAccepted: "yes" } }).error.message,
    "termsAccepted must be a boolean.",
  );
  assert.equal(
    run(linkedinValidation, { body: { code: "x", termsAccepted: 1 } }).error.statusCode,
    400,
  );
  assert.equal(
    run(socialValidation, {
      body: { provider: "google", providerId: "x", termsAccepted: null },
    }).error.statusCode,
    400,
  );
});

test("add-role validation and public error serialization preserve expected contracts", () => {
  assert.equal(run(addRoleValidation, { body: { role: "mentor" } }).nextCalled, true);
  assert.equal(run(addRoleValidation, { body: { role: "admin" } }).error.code, "INVALID_ROLE");

  let statusCode;
  let body;
  errorHandler(
    Object.assign(new Error("not verified"), {
      statusCode: 403,
      code: "EMAIL_NOT_VERIFIED",
      isEmailVerified: false,
      email: "ada@example.com",
    }),
    {},
    {
      status: (code) => {
        statusCode = code;
        return {
          json: (payload) => {
            body = payload;
          },
        };
      },
    },
    () => {},
  );
  assert.equal(statusCode, 403);
  assert.equal(body.isEmailVerified, false);
  assert.equal(body.email, "ada@example.com");

  errorHandler(
    Object.assign(new Error("duplicate key"), { code: 11000 }),
    {},
    {
      status: (code) => {
        statusCode = code;
        return { json: (payload) => { body = payload; } };
      },
    },
    () => {},
  );
  assert.equal(statusCode, 409);

  errorHandler(
    {},
    {},
    {
      status: (code) => {
        statusCode = code;
        return { json: (payload) => { body = payload; } };
      },
    },
    () => {},
  );
  assert.equal(statusCode, 500);
  assert.equal(body.message, "Internal server error");
  assert.equal(body.code, "INTERNAL_ERROR");
});
