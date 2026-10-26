const test = require("node:test");
const assert = require("node:assert/strict");

const createGoogleAuthService = require("../../services/googleAuth.service");

test("verifies a Google credential and passes the trusted profile to federation", async () => {
  const calls = [];
  const service = createGoogleAuthService({
    clientId: "google-client-id",
    googleClient: {
      verifyIdToken: async (options) => {
        calls.push(options);
        return {
          getPayload: () => ({
            sub: "google-sub",
            email: "USER@EXAMPLE.COM",
            name: "Google User",
            email_verified: true,
          }),
        };
      },
    },
    federatedAuthService: {
      authenticateFederatedUser: async (profile, options) => ({ profile, options }),
    },
  });

  const result = await service.googleAuthUser(
    { credential: "google-jwt", roles: ["mentor"], termsAccepted: true },
    { correlationId: "corr-google-1" },
  );

  assert.deepEqual(calls, [
    { idToken: "google-jwt", audience: "google-client-id" },
  ]);
  assert.deepEqual(result.profile, {
    provider: "google",
    providerId: "google-sub",
    email: "USER@EXAMPLE.COM",
    name: "Google User",
    roles: ["mentor"],
    termsAccepted: true,
    emailVerified: true,
  });
  assert.deepEqual(result.options, { correlationId: "corr-google-1" });
});

test("rejects missing or invalid Google credentials", async () => {
  const service = createGoogleAuthService({
    clientId: "google-client-id",
    googleClient: { verifyIdToken: async () => { throw new Error("expired"); } },
    federatedAuthService: {},
  });

  await assert.rejects(
    () => service.googleAuthUser({}),
    { statusCode: 400, code: "GOOGLE_CREDENTIAL_REQUIRED" },
  );
  await assert.rejects(
    () => service.googleAuthUser({ credential: "expired" }),
    { statusCode: 401, code: "GOOGLE_CREDENTIAL_INVALID" },
  );
});

test("does not attempt verification when Google is not configured", async () => {
  const service = createGoogleAuthService({
    clientId: "",
    googleClient: { verifyIdToken: async () => assert.fail("not called") },
    federatedAuthService: {},
  });

  await assert.rejects(
    () => service.googleAuthUser({ credential: "jwt" }),
    { statusCode: 503, code: "GOOGLE_NOT_CONFIGURED" },
  );
});
