const test = require("node:test");
const assert = require("node:assert/strict");

const createOAuthStateService = require("../../utils/oauthState.service");

test("signs and verifies LinkedIn OAuth state", () => {
  const service = createOAuthStateService({ secret: "state-secret" });
  const state = service.signState({ role: "mentor", termsAccepted: true });
  assert.deepEqual(service.verifyState(state), {
    role: "mentor",
    termsAccepted: true,
  });
});

test("rejects missing, malformed, and tampered state", () => {
  const service = createOAuthStateService({ secret: "state-secret" });
  assert.throws(() => service.verifyState(), /Invalid state parameter/);
  assert.throws(() => service.verifyState("bad-state"), /Invalid state parameter/);
  const state = service.signState({ role: "mentee" });
  const [data, signature] = state.split(".");
  assert.throws(
    () => service.verifyState(`${data}.${signature.slice(0, -1)}0`),
    /Invalid state parameter/,
  );
});
