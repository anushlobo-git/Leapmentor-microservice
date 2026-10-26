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
