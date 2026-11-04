const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createForgotPasswordController = require("../../controllers/forgotPassword.controller");
const createForgotPasswordRouter = require("../../routes/forgotPassword.routes");
const validations = require("../../middleware/forgotPasswordValidation");

const startTestServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test("forgot-password route returns its ambiguous success envelope", async () => {
  const controller = createForgotPasswordController({
    forgotPasswordService: {
      sendForgotPasswordOtp: async () => ({
        message: "If this email exists, an OTP has been sent.",
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    forgotPasswordRouter: createForgotPasswordRouter({
      forgotPasswordController: controller,
      validations,
    }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { message: "If this email exists, an OTP has been sent." },
      message: "Password reset OTP sent",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("reset-password route rejects short passwords before service execution", async () => {
  let called = false;
  const controller = createForgotPasswordController({
    forgotPasswordService: {
      resetPassword: async () => {
        called = true;
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    forgotPasswordRouter: createForgotPasswordRouter({
      forgotPasswordController: controller,
      validations,
    }),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        otp: "123456",
        newPassword: "123",
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
