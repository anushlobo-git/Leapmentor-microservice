const test = require("node:test");
const assert = require("node:assert/strict");

const createUploadService = require("../../services/upload.service");

const createService = ({ configured = true, profile = { _id: "profile-1" } } = {}) => {
  const uploads = [];
  const destroyed = [];
  const cloudinary = {
    uploader: {
      upload_stream: (options, callback) => {
        uploads.push(options);
        callback(null, {
          secure_url: `https://cdn.example/${uploads.length}`,
          public_id: `public-${uploads.length}`,
        });
        return { pipe: () => undefined };
      },
      destroy: async (publicId) => {
        destroyed.push(publicId);
      },
    },
  };
  const repository = {
    findOneAndUpdateByUserId: async () => profile,
  };
  const service = createUploadService({
    cloudinary,
    cloudinaryConfigured: configured,
    streamifier: { createReadStream: () => ({ pipe: () => undefined }) },
    mentorProfileRepository: repository,
    toMentorProfileDTO: (value) => ({ mapped: value._id }),
    logger: { error: () => undefined, warn: () => undefined },
  });
  return { service, uploads, destroyed, repository };
};

test("uploads a profile picture and returns the Cloudinary asset DTO", async () => {
  const { service, uploads } = createService();

  const result = await service.processProfilePicture({
    mimetype: "image/png",
    originalname: "avatar.png",
    buffer: Buffer.from("avatar"),
  }, "custom-avatar.png");

  assert.deepEqual(result, {
    url: "https://cdn.example/1",
    publicId: "public-1",
    fileName: "custom-avatar.png",
  });
  assert.equal(uploads[0].folder, "leapmentor/profiles");
  assert.equal(uploads[0].resource_type, "image");
});

test("updates mentor verification documents and marks the profile pending", async () => {
  const { service, uploads, repository } = createService();
  let update;
  repository.findOneAndUpdateByUserId = async (_userId, data) => {
    update = data;
    return { _id: "profile-1" };
  };

  const result = await service.processVerificationDocuments(
    { _id: "user-1" },
    { phoneNumber: " +1 555 0100 " },
    {
      resume: [{ originalname: "resume.pdf", buffer: Buffer.from("resume") }],
      workExperienceDocs: [
        { originalname: "work.pdf", buffer: Buffer.from("work") },
      ],
    },
  );

  assert.deepEqual(result, { mapped: "profile-1" });
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].folder, "leapmentor/verification-docs/resumes");
  assert.equal(uploads[1].folder, "leapmentor/verification-docs/work-experience");
  assert.equal(update.phoneNumber, "+1 555 0100");
  assert.equal(update.verificationStatus, "pending");
  assert.equal(update.workExperienceDocuments.length, 1);
});

test("rolls back uploaded verification files when the profile update fails", async () => {
  const { service, destroyed, repository } = createService();
  repository.findOneAndUpdateByUserId = async () => null;

  await assert.rejects(
    service.processVerificationDocuments(
      { _id: "user-1" },
      { phoneNumber: "12345" },
      { resume: [{ originalname: "resume.pdf", buffer: Buffer.from("resume") }] },
    ),
    { statusCode: 500, code: "VERIFICATION_UPLOAD_FAILED" },
  );
  assert.deepEqual(destroyed, ["public-1"]);
});

test("returns a clear provider error when Cloudinary is not configured", async () => {
  const { service } = createService({ configured: false });

  await assert.rejects(
    service.processProfilePicture({ mimetype: "image/png", buffer: Buffer.from("x") }),
    { statusCode: 503, code: "UPLOAD_PROVIDER_NOT_CONFIGURED" },
  );
});
