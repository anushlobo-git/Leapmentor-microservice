const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminPayments.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("aggregates completed paid-session revenue and refund count from Workspace records", async () => {
  const controller = createController({
    connectRequestRepository: {
      findCompletedPaidSessions: async () => [
        { totalAmount: 120, commissionAmount: 20 },
        { totalAmount: 80, commissionAmount: 10 },
      ],
      countRefundedRequests: async () => 3,
    },
  });
  const res = response();
  await controller.getStats({}, res, assert.fail);
  assert.deepEqual(res.body.data, {
    totalRevenue: 200,
    platformCommission: 30,
    refundedRequests: 3,
  });
});

test("returns six monthly revenue points from Workspace session records", async () => {
  const monthRanges = [];
  const controller = createController({
    connectRequestRepository: {
      findSessionsByMonth: async (start, end) => {
        monthRanges.push([start, end]);
        return [{ totalAmount: 40 }];
      },
    },
  });
  const res = response();
  await controller.getChart({}, res, assert.fail);
  assert.equal(res.body.data.length, 6);
  assert.equal(res.body.data[0].amount, 40);
  assert.equal(monthRanges.length, 6);
  assert.equal(monthRanges[0][1].getTime(), monthRanges[1][0].getTime());
});

test("treats missing payment amounts as zero and forwards repository errors", async () => {
  const controller = createController({
    connectRequestRepository: {
      findCompletedPaidSessions: async () => [
        {},
        { totalAmount: null, commissionAmount: undefined },
      ],
      countRefundedRequests: async () => 0,
    },
  });
  const res = response();
  await controller.getStats({}, res, assert.fail);
  assert.deepEqual(res.body.data, {
    totalRevenue: 0,
    platformCommission: 0,
    refundedRequests: 0,
  });

  const expected = new Error("finance repository failed");
  const statsError = createController({
    connectRequestRepository: {
      findCompletedPaidSessions: async () => { throw expected; },
      countRefundedRequests: async () => 0,
    },
  });
  let received;
  await statsError.getStats({}, response(), (error) => { received = error; });
  assert.equal(received, expected);

  const chartError = createController({
    connectRequestRepository: {
      findSessionsByMonth: async () => { throw expected; },
    },
  });
  received = undefined;
  await chartError.getChart({}, response(), (error) => { received = error; });
  assert.equal(received, expected);
});

test("returns zero for months with no revenue", async () => {
  const controller = createController({
    connectRequestRepository: { findSessionsByMonth: async () => [] },
  });
  const res = response();
  await controller.getChart({}, res, assert.fail);
  assert.equal(res.body.data.every((month) => month.amount === 0), true);
});
