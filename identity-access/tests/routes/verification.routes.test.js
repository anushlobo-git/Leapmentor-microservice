const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createVerificationController = require("../../controllers/verification.controller");
const createVerificationRouter = require("../../routes/verification.routes");
const validations = require("../../middleware/verificationValidation");

const startTestServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test("OTP verification route returns the public success envelope", async () => {
  const verificationController = createVerificationController({
    verificationService: {
      processOtpVerification: async (email, otp) => {
        assert.equal(email, "user@example.com");
        assert.equal(otp, "123456");
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    verificationRouter: createVerificationRouter({
      verificationController,
      validations,
    }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/verification/verify-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", otp: "123456" }),
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: null,
      message: "Email verified successfully",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("verification route rejects malformed OTP before calling the service", async () => {
  let called = false;
  const verificationController = createVerificationController({
    verificationService: {
      processOtpVerification: async () => {
        called = true;
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    verificationRouter: createVerificationRouter({
      verificationController,
      validations,
    }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/verification/verify-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", otp: "12" }),
      },
    );

    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
