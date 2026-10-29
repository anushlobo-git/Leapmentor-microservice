const test = require("node:test");
const assert = require("node:assert/strict");

const { toMentorSearchDTO } = require("../../utils/mentorSearch.mapper");

test("includes education in mentor search results", () => {
  const result = toMentorSearchDTO(
    {
      user: "user-1",
      education: "B.Tech in Computer Science",
    },
    { _id: "user-1", name: "Shama" },
  );

  assert.equal(result.education, "B.Tech in Computer Science");
});
