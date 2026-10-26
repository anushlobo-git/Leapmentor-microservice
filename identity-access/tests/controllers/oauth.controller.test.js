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
