const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("node:stream");

const createCloudinaryClient = require("../../clients/cloudinaryClient");

const fakeStreamifier = {
  createReadStream: (buffer) => Readable.from([buffer]),
};

const fakeCloudinary = ({ result, error, destroyResult } = {}) => {
  const calls = { upload: [], written: [], destroy: [] };
  return {
    calls,
    uploader: {
      upload_stream: (options, callback) => {
        calls.upload.push(options);
        return new Writable({
          write(chunk, _encoding, done) {
            calls.written.push(chunk);
            done();
          },
          final(done) {
            callback(error, error ? undefined : result);
            done();
          },
        });
      },
      destroy: async (publicId, options) => {
        calls.destroy.push([publicId, options]);
        return destroyResult ?? { result: "ok" };
      },
    },
  };
};

test("uploadRawBuffer streams the buffer with the monolith options and returns url and publicId", async () => {
  const cloudinary = fakeCloudinary({
    result: { secure_url: "https://cdn.example/a.pdf", public_id: "folder/a" },
  });
  const client = createCloudinaryClient({
    cloudinary,
    streamifier: fakeStreamifier,
    configured: true,
  });

  const uploaded = await client.uploadRawBuffer(Buffer.from("hello"), {
    folder: "leapmentor/notes/request-1",
  });

  assert.deepEqual(uploaded, {
    url: "https://cdn.example/a.pdf",
    publicId: "folder/a",
  });
  assert.deepEqual(cloudinary.calls.upload, [
    {
      resource_type: "raw",
      use_filename: true,
      unique_filename: true,
      timeout: 120000,
      chunk_size: 6000000,
      folder: "leapmentor/notes/request-1",
    },
  ]);
  assert.equal(Buffer.concat(cloudinary.calls.written).toString(), "hello");
});

test("uploadRawBuffer works with the real streamifier package", async () => {
  const streamifier = require("streamifier");
  const cloudinary = fakeCloudinary({
    result: { secure_url: "https://cdn.example/b", public_id: "b" },
  });
  const client = createCloudinaryClient({
    cloudinary,
    streamifier,
    configured: true,
  });

  await client.uploadRawBuffer(Buffer.from("real"));

  assert.equal(Buffer.concat(cloudinary.calls.written).toString(), "real");
});

test("uploadRawBuffer turns provider errors into a coded Error", async () => {
  for (const error of [
    new Error("boom"),
    { message: "bad creds", http_code: 401 },
  ]) {
    const client = createCloudinaryClient({
      cloudinary: fakeCloudinary({ error }),
      streamifier: fakeStreamifier,
      configured: true,
    });

    await assert.rejects(client.uploadRawBuffer(Buffer.from("x")), (thrown) => {
      assert.equal(thrown.code, "CLOUDINARY_UPLOAD_FAILED");
      assert.equal(thrown.message, error.message);
      return true;
    });
  }
});

test("an error object without a message is stringified", async () => {
  const client = createCloudinaryClient({
    cloudinary: fakeCloudinary({ error: { http_code: 500 } }),
    streamifier: fakeStreamifier,
    configured: true,
  });

  await assert.rejects(client.uploadRawBuffer(Buffer.from("x")), (thrown) => {
    assert.equal(thrown.message, '{"http_code":500}');
    return true;
  });
});

test("destroyRawAsset removes a raw asset", async () => {
  const cloudinary = fakeCloudinary({ destroyResult: { result: "ok" } });
  const client = createCloudinaryClient({
    cloudinary,
    streamifier: fakeStreamifier,
    configured: true,
  });

  assert.deepEqual(await client.destroyRawAsset("folder/a"), { result: "ok" });
  assert.deepEqual(cloudinary.calls.destroy, [
    ["folder/a", { resource_type: "raw" }],
  ]);
});

test("both operations fail with 503 and never touch the provider when not configured", async () => {
  const cloudinary = fakeCloudinary();
  const client = createCloudinaryClient({
    cloudinary,
    streamifier: fakeStreamifier,
    configured: false,
  });

  for (const action of [
    () => client.uploadRawBuffer(Buffer.from("x")),
    () => client.destroyRawAsset("folder/a"),
  ]) {
    await assert.rejects(action(), (thrown) => {
      assert.equal(thrown.statusCode, 503);
      assert.equal(thrown.code, "UPLOAD_PROVIDER_NOT_CONFIGURED");
      return true;
    });
  }
  assert.equal(cloudinary.calls.upload.length, 0);
  assert.equal(cloudinary.calls.destroy.length, 0);
});
