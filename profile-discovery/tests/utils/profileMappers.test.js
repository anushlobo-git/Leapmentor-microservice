const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { toMenteeProfileDTO } = require("../../utils/menteeProfile.mapper");
const { toMentorProfileDTO } = require("../../utils/mentorProfile.mapper");

test("maps mentee account details supplied by Identity without a Mongoose populate", () => {
  const profile = {
    _id: "mentee-profile-1",
    user: "user-1",
    bio: "Learning",
  };
  const user = {
    _id: "user-1",
    name: "Taylor Mentee",
    email: "mentee@example.com",
    isEmailVerified: true,
  };

  assert.deepEqual(toMenteeProfileDTO(profile, user).user, {
    id: "user-1",
    name: "Taylor Mentee",
    email: "mentee@example.com",
    isEmailVerified: true,
  });
  assert.equal(profile.user, "user-1");
});

test("maps mentor account details supplied by Identity without a Mongoose populate", () => {
  const profile = {
    _id: "mentor-profile-1",
    user: "user-2",
    bio: "Mentoring",
  };
  const user = {
    _id: "user-2",
    name: "Morgan Mentor",
    email: "mentor@example.com",
  };

  assert.deepEqual(toMentorProfileDTO(profile, user).user, {
    _id: "user-2",
    name: "Morgan Mentor",
    email: "mentor@example.com",
  });
  assert.equal(profile.user, "user-2");
});

test("keeps raw ObjectId references as strings when account details are not requested", () => {
  const userId = new mongoose.Types.ObjectId();

  assert.equal(toMenteeProfileDTO({ user: userId }).user, userId.toString());
  assert.equal(toMentorProfileDTO({ user: userId }).user, userId.toString());
});
