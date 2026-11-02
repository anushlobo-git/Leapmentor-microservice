const test = require("node:test");
const assert = require("node:assert/strict");

const createOAuthController = require("../../controllers/oauth.controller");

const createResponse = () => ({
  statusCode: null,
  body: null,
  location: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  redirect(location) {
    this.location = location;
    return this;
  },
});

test("Google auth returns the session and sets the refresh cookie", async () => {
  const calls = [];
  const controller = createOAuthController({
    googleAuthService: {
      googleAuthUser: async (body, options) => {
        calls.push({ body, options });
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: { _id: "user-1" },
          isNewUser: true,
        };
      },
    },
    cookieService: { setRefreshCookie: (res, token) => { res.cookie = token; } },
    federatedAuthService: {},
    linkedinAuthService: {},
    oauthStateService: {},
    clientId: "linkedin-client",
    callbackUrl: "callback",
    clientUrl: "http://localhost:5173",
  });
  const res = createResponse();

  await controller.google(
    { body: { credential: "credential" }, correlationId: "corr-google" },
    res,
    assert.fail,
  );

  assert.deepEqual(calls, [
    { body: { credential: "credential" }, options: { correlationId: "corr-google" } },
  ]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.cookie, "refresh-token");
  assert.equal(res.body.data.accessToken, "access-token");
});

test("LinkedIn callback rejects an invalid state and redirects to the frontend", () => {
  const controller = createOAuthController({
    googleAuthService: {},
    federatedAuthService: {},
    linkedinAuthService: {},
    cookieService: {},
    oauthStateService: { verifyState: () => { throw new Error("tampered"); } },
    clientId: "linkedin-client",
    callbackUrl: "callback",
    clientUrl: "http://localhost:5173/",
  });
  const res = createResponse();

  controller.linkedinCallback(
    { query: { code: "code", state: "bad-state" } },
    res,
  );

  assert.equal(
    res.location,
    "http://localhost:5173/?linkedin=failure&reason=invalid_state",
  );
});

test("LinkedIn redirect signs state and sends the browser to LinkedIn", () => {
  const controller = createOAuthController({
    googleAuthService: {},
    federatedAuthService: {},
    linkedinAuthService: {},
    cookieService: {},
    oauthStateService: { signState: (payload) => `signed-${payload.role}` },
    clientId: "linkedin-client",
    callbackUrl: "http://localhost:5001/api/v1/auth/linkedin/callback",
    clientUrl: "http://localhost:5173",
  });
  const res = createResponse();

  controller.linkedinRedirect(
    { query: { role: "mentor", termsAccepted: "true" } },
    res,
  );

  assert.match(res.location, /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?/);
  assert.match(res.location, /client_id=linkedin-client/);
  assert.match(res.location, /state=signed-mentor/);
});

test("OAuth controller handles Google, generic social, and LinkedIn token success and failures", async () => {
  const calls = [];
  const warnings = [];
  const controller = createOAuthController({
    googleAuthService: {
      googleAuthUser: async () => { throw new Error("Google unavailable"); },
    },
    federatedAuthService: {
      socialAuthUser: async (body, options) => {
        calls.push(["social", body, options]);
        if (body.provider === "custom") throw new Error("social failure");
        return { accessToken: "social-access", refreshToken: "social-refresh", user: { _id: "social" } };
      },
    },
    linkedinAuthService: {
      exchangeLinkedinCode: async (body, options) => {
        if (!body.code) throw new Error("LinkedIn unavailable");
        calls.push(["linkedin", body, options]);
        return { accessToken: "linkedin-access", refreshToken: "linkedin-refresh", user: { _id: "linkedin" } };
      },
    },
    cookieService: { setRefreshCookie: (res, token) => { res.cookie = token; } },
    oauthStateService: {},
    clientId: "client",
    callbackUrl: "callback",
    clientUrl: "http://localhost",
    logger: { warn: (...args) => warnings.push(args) },
  });

  const socialRes = createResponse();
  await controller.social(
    { body: { provider: "apple" }, correlationId: "corr-social" },
    socialRes,
    assert.fail,
  );
  assert.equal(socialRes.body.message, "Social login successful");
  assert.equal(socialRes.cookie, "social-refresh");
  const linkedinRes = createResponse();
  await controller.linkedinToken(
    { body: { code: "code" }, correlationId: "corr-linkedin" },
    linkedinRes,
    assert.fail,
  );
  assert.equal(linkedinRes.body.message, "LinkedIn login successful");
  assert.equal(linkedinRes.cookie, "linkedin-refresh");
  assert.deepEqual(calls, [
    ["social", { provider: "apple" }, { correlationId: "corr-social" }],
    ["linkedin", { code: "code" }, { correlationId: "corr-linkedin" }],
  ]);

  let googleError;
  await controller.google({ body: {}, correlationId: "corr-error" }, createResponse(), (error) => {
    googleError = error;
  });
  assert.match(googleError.message, /Google unavailable/);

  let socialError;
  await controller.social(
    { body: { provider: "custom" } },
    createResponse(),
    (error) => { socialError = error; },
  );
  assert.match(socialError.message, /social failure/);
  assert.equal(warnings[0][0], "Generic social authentication failed");

  let linkedinError;
  await controller.linkedinToken(
    { body: {} },
    createResponse(),
    (error) => { linkedinError = error; },
  );
  assert.match(linkedinError.message, /LinkedIn unavailable/);
});

test("LinkedIn redirect and callback handle configuration, provider errors, and successful state", () => {
  const unconfigured = createOAuthController({
    googleAuthService: {},
    federatedAuthService: {},
    linkedinAuthService: {},
    cookieService: {},
    oauthStateService: {},
    clientId: "",
    callbackUrl: "callback",
    clientUrl: "http://localhost/",
  });
  const unavailableRes = createResponse();
  unconfigured.linkedinRedirect({ query: {} }, unavailableRes);
  assert.equal(unavailableRes.statusCode, 503);
  assert.equal(unavailableRes.body.code, "LINKEDIN_NOT_CONFIGURED");

  const controller = createOAuthController({
    googleAuthService: {},
    federatedAuthService: {},
    linkedinAuthService: {},
    cookieService: {},
    oauthStateService: {
      signState: (payload) => JSON.stringify(payload),
      verifyState: (state) => {
        if (state !== "valid") throw new Error("invalid state");
      },
    },
    clientId: "client",
    callbackUrl: "callback",
    clientUrl: "http://localhost/",
  });
  const providerErrorRes = createResponse();
  controller.linkedinCallback(
    { query: { error: "access_denied" } },
    providerErrorRes,
  );
  assert.equal(providerErrorRes.location, "http://localhost/?linkedin=failure");

  const missingCodeRes = createResponse();
  controller.linkedinCallback({ query: {} }, missingCodeRes);
  assert.equal(missingCodeRes.location, "http://localhost/?linkedin=failure");

  const successRes = createResponse();
  controller.linkedinCallback(
    { query: { code: "auth code", state: "valid" } },
    successRes,
  );
  assert.match(successRes.location, /\/sso-callback\?code=auth\+code/);
  assert.match(successRes.location, /provider=linkedin/);

  const redirectRes = createResponse();
  controller.linkedinRedirect(
    { query: { role: "mentee", termsAccepted: "false" } },
    redirectRes,
  );
  assert.match(redirectRes.location, /termsAccepted%22%3Afalse/);
});
