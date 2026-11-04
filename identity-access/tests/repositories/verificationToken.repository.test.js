const test = require("node:test");
const assert = require("node:assert/strict");

const createVerificationTokenRepository = require("../../repositories/verificationToken.repository");

test("saves updated verification token documents", async () => {
  const savedTokens = [];
  const tokenDocument = {
    expiresAt: new Date("2026-10-24T12:05:00.000Z"),
    save: async function () {
      savedTokens.push(this);
      return this;
    },
  };
  const repository = createVerificationTokenRepository({});

  const result = await repository.saveToken(tokenDocument);

  assert.equal(result, tokenDocument);
  assert.deepEqual(savedTokens, [tokenDocument]);
});
