const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createUploadRouter = require("../../routes/upload.routes");
const { verificationDocumentsValidation } = require("../../middleware/uploadValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

const passThrough = (req, _res, next) => next();

test("upload routes keep profile pictures available to authenticated users and documents mentor-only", async () => {
  const router = createUploadRouter({
    authenticate: (req, _res, next) => {
      req.user = { _id: "user-1", roles: ["mentee"] };
      next();
    },
    requireRole: (...roles) => (req, res, next) =>
      roles.some((role) => req.user.roles.includes(role))
        ? next()
        : res.status(403).json({ code: "ROLE_REQUIRED" }),
    uploadMiddleware: {
      profilePictureUpload: passThrough,
      verificationDocumentsUpload: passThrough,
    },
    validations: { verificationDocumentsValidation },
    uploadController: {
      uploadProfilePicture: (_req, res) => res.status(200).json({ route: "picture" }),
      uploadVerificationDocuments: (_req, res) => res.status(200).json({ route: "docs" }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    uploadRouter: router,
  });

  try {
    const picture = await fetch(`${serverDetails.url}/api/v1/upload/profile-picture`, {
      method: "POST",
    });
    const documents = await fetch(
      `${serverDetails.url}/api/v1/upload/verification-documents`,
      { method: "POST" },
    );
    assert.equal(picture.status, 200);
    assert.equal(documents.status, 403);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("verification upload validation requires a bounded phone number", () => {
  let captured;
  verificationDocumentsValidation({ body: { phoneNumber: "123" } }, {}, (error) => {
    captured = error;
  });
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.code, "INVALID_UPLOAD_FIELDS");
});
