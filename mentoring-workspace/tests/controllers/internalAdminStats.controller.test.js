const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminStats.controller");

test("filters admin engagement history to the exact mentee ID", async () => {
  let countFilter;
  let listFilter;
  const controller = createController({
    connectRequestRepository: {
      countByFilter: async (filter) => {
        countFilter = filter;
        return 1;
      },
      findEngagements: async (filter) => {
        listFilter = filter;
        return [
          {
            _id: "engagement-1",
            mentee: "mentee-1",
            mentor: "mentor-1",
            status: "completed",
          },
        ];
      },
    },
  });
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.getEngagements(
    { query: { menteeId: "mentee-1", page: "1", limit: "50" } },
    res,
    assert.fail,
  );

  assert.deepEqual(countFilter, { mentee: "mentee-1" });
  assert.deepEqual(listFilter, countFilter);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.engagements.length, 1);
});
