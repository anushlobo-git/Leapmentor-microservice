const test = require("node:test");
const assert = require("node:assert/strict");

const validations = require("../../middleware/mentorProfileValidation");

test("accepts a valid mentor create payload", () => {
  let called = false;
  validations.createProfileValidation(
    {
      body: {
        currentRole: "Engineer",
        industry: "Technology",
        education: "B.Tech in Computer Science",
        bio: "Builds systems.",
        skills: ["Node.js"],
        languages: ["English"],
        linkedInUrl: "https://linkedin.com/in/example",
      },
    },
    {},
    () => {
      called = true;
    },
  );
  assert.equal(called, true);
});

test("accepts education in mentor profile create and update payloads", () => {
  const body = {
    currentRole: "Senior Developer Engineer",
    industry: "Technology",
    education: "B.Tech in Computer Science, VIT Vellore",
    bio: "Experienced developer.",
    skills: ["JavaScript"],
  };
  let createError;
  let updateError;

  validations.createProfileValidation(
    { body },
    {},
    (error) => {
      createError = error;
    },
  );
  validations.updateProfileValidation(
    { body: { education: body.education } },
    {},
    (error) => {
      updateError = error;
    },
  );

  assert.equal(createError, undefined);
  assert.equal(updateError, undefined);
});

test("rejects non-string mentor education values", () => {
  let error;
  validations.updateProfileValidation(
    { body: { education: ["B.Tech"] } },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.code, "INVALID_PROFILE");
  assert.equal(error.message, "education must be a string.");
});

test("rejects invalid URL and out-of-range profile values", () => {
  let error;
  validations.updateProfileValidation(
    {
      body: {
        hourlyRate: -1,
        linkedInUrl: "not-a-url",
      },
    },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.statusCode, 400);
});

test("rejects unsupported fields instead of allowing mass assignment", () => {
  let error;
  validations.updateProfileValidation(
    { body: { isProfilePublished: false } },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.code, "INVALID_PROFILE");
});

test("requires a valid ObjectId for public profile lookup", () => {
  let error;
  validations.mentorIdParamValidation(
    { params: { id: "not-an-object-id" } },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.code, "INVALID_PROFILE_ID");
});
