const test = require("node:test");
const assert = require("node:assert/strict");

const validations = require("../../middleware/menteeProfileValidation");

test("accepts a valid mentee create payload", () => {
  let called = false;
  validations.createProfileValidation(
    {
      body: {
        currentRole: "Student",
        industry: "Technology",
        bio: "Learning systems.",
        skills: ["JavaScript"],
        interestedFields: ["Backend Engineering"],
        languages: [],
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

test("accepts settings-only updates", () => {
  let called = false;
  validations.updateProfileValidation(
    { body: { emailNotifications: false, marketingPreferences: true } },
    {},
    () => {
      called = true;
    },
  );
  assert.equal(called, true);
});

test("rejects missing interested fields and unsupported update fields", () => {
  let createError;
  validations.createProfileValidation(
    {
      body: {
        currentRole: "Student",
        industry: "Technology",
        bio: "Bio",
        skills: ["JavaScript"],
      },
    },
    {},
    (error) => {
      createError = error;
    },
  );
  assert.equal(createError.code, "INVALID_INTERESTED_FIELDS");

  let updateError;
  validations.updateProfileValidation(
    { body: { isProfilePublished: false } },
    {},
    (error) => {
      updateError = error;
    },
  );
  assert.equal(updateError.code, "INVALID_PROFILE");
});

test("requires a valid ObjectId for public mentee lookup", () => {
  let error;
  validations.menteeIdParamValidation(
    { params: { id: "invalid" } },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.code, "INVALID_PROFILE_ID");
});
