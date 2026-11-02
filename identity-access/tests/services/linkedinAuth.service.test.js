const test = require("node:test");
const assert = require("node:assert/strict");

const createLinkedinAuthService = require("../../services/linkedinAuth.service");

const response = (body, ok = true) => ({
  ok,
  json: async () => body,
});

test("exchanges a LinkedIn code and passes the OpenID profile to federation", async () => {
  const requests = [];
  const service = createLinkedinAuthService({
    clientId: "linkedin-client-id",
    clientSecret: "linkedin-client-secret",
    callbackUrl: "http://localhost/callback",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.includes("accessToken")) return response({ access_token: "linkedin-token" });
      return response({ sub: "linkedin-sub", email: "USER@EXAMPLE.COM", name: "LinkedIn User" });
    },
    federatedAuthService: {
      authenticateFederatedUser: async (profile, options) => ({ profile, options }),
    },
  });

  const result = await service.exchangeLinkedinCode(
    { code: "linkedin-code", roles: ["mentee"], termsAccepted: true },
    { correlationId: "corr-linkedin-1" },
  );

  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.body.get("code"), "linkedin-code");
  assert.deepEqual(result.profile, {
    provider: "linkedin",
    providerId: "linkedin-sub",
    email: "USER@EXAMPLE.COM",
    name: "LinkedIn User",
    roles: ["mentee"],
    termsAccepted: true,
    emailVerified: true,
  });
  assert.deepEqual(result.options, { correlationId: "corr-linkedin-1" });
});

test("builds a fallback LinkedIn name from given and family names", async () => {
  let profile;
  const service = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async (url) =>
      url.includes("accessToken")
        ? response({ access_token: "token" })
        : response({ sub: "sub", email: "user@example.com", given_name: "Jane", family_name: "Doe" }),
    federatedAuthService: {
      authenticateFederatedUser: async (value) => {
        profile = value;
        return {};
      },
    },
  });

  await service.exchangeLinkedinCode({ code: "code" });
  assert.equal(profile.name, "Jane Doe");
});

test("maps LinkedIn exchange and profile failures to stable errors", async () => {
  const service = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async (url) =>
      url.includes("accessToken")
        ? response({ error_description: "code expired" }, false)
        : response({}, false),
    federatedAuthService: {},
  });

  await assert.rejects(
    () => service.exchangeLinkedinCode({}),
    { statusCode: 400, code: "LINKEDIN_CODE_REQUIRED" },
  );
  await assert.rejects(
    () => service.exchangeLinkedinCode({ code: "expired" }),
    { statusCode: 401, code: "LINKEDIN_TOKEN_EXCHANGE_FAILED" },
  );
});

test("rejects a LinkedIn profile without sub or email", async () => {
  const service = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async (url) =>
      url.includes("accessToken")
        ? response({ access_token: "token" })
        : response({ name: "Incomplete" }),
    federatedAuthService: {},
  });

  await assert.rejects(
    () => service.exchangeLinkedinCode({ code: "code" }),
    { statusCode: 400, code: "LINKEDIN_PROFILE_INVALID" },
  );
});

test("LinkedIn exchange validates configuration and transport before making requests", async () => {
  const missingConfig = createLinkedinAuthService({
    clientId: "",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async () => assert.fail("fetch must not run"),
    federatedAuthService: {},
  });
  await assert.rejects(
    missingConfig.exchangeLinkedinCode({ code: "code" }),
    { statusCode: 503, code: "LINKEDIN_NOT_CONFIGURED" },
  );

  const missingTransport = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: null,
    federatedAuthService: {},
  });
  await assert.rejects(
    missingTransport.exchangeLinkedinCode({ code: "code" }),
    { statusCode: 503, code: "LINKEDIN_TRANSPORT_UNAVAILABLE" },
  );
});

test("LinkedIn exchange maps transport errors and invalid JSON responses", async () => {
  const tokenTransportFailure = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async () => { throw new Error("network unavailable"); },
    federatedAuthService: {},
  });
  await assert.rejects(
    tokenTransportFailure.exchangeLinkedinCode({ code: "code" }),
    (error) => error.code === "LINKEDIN_TOKEN_EXCHANGE_FAILED" && /network unavailable/.test(error.message),
  );

  let requestCount = 0;
  const profileTransportFailure = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return response({ access_token: "token" });
      throw new Error("profile endpoint down");
    },
    federatedAuthService: {},
  });
  await assert.rejects(
    profileTransportFailure.exchangeLinkedinCode({ code: "code" }),
    (error) => error.code === "LINKEDIN_PROFILE_FETCH_FAILED" && /profile endpoint down/.test(error.message),
  );

  const invalidJson = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes("accessToken")) return {};
        throw new Error("invalid JSON");
      },
    }),
    federatedAuthService: {},
  });
  await assert.rejects(
    invalidJson.exchangeLinkedinCode({ code: "code" }),
    { statusCode: 401, code: "LINKEDIN_TOKEN_EXCHANGE_FAILED" },
  );
});

test("LinkedIn exchange falls back to a generic name and rejects unsuccessful profile responses", async () => {
  let receivedProfile;
  const service = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async (url) =>
      url.includes("accessToken")
        ? response({ access_token: "token" })
        : response({ sub: "linkedin-sub", email: "user@example.com" }),
    federatedAuthService: {
      authenticateFederatedUser: async (profile) => {
        receivedProfile = profile;
        return { user: profile };
      },
    },
  });
  await service.exchangeLinkedinCode({ code: "code" });
  assert.equal(receivedProfile.name, "User");

  let callCount = 0;
  const unsuccessfulProfile = createLinkedinAuthService({
    clientId: "id",
    clientSecret: "secret",
    callbackUrl: "callback",
    fetchImpl: async () => {
      callCount += 1;
      return callCount === 1
        ? response({ access_token: "token" })
        : response({ sub: "sub", email: "user@example.com" }, false);
    },
    federatedAuthService: {},
  });
  await assert.rejects(
    unsuccessfulProfile.exchangeLinkedinCode({ code: "code" }),
    { statusCode: 400, code: "LINKEDIN_PROFILE_INVALID" },
  );
});
