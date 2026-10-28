const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Feedback = require("../../models/Feedback");

const objectId = () => new mongoose.Types.ObjectId();
const valid = (overrides = {}) => ({
  connectRequest: objectId(),
  from: objectId(),
  to: objectId(),
  fromRole: "mentee",
  rating: 4,
  ...overrides,
});

test("a feedback with the required fields is valid and gets the defaults", () => {
  const feedback = new Feedback(valid());
  assert.equal(feedback.validateSync(), undefined);
  assert.equal(feedback.comment, "");
  assert.equal(feedback.slotIndex, null);
});

test("required fields, role and rating bounds are enforced", () => {
  const errors = (data) => new Feedback(data).validateSync()?.errors || {};
  assert.ok(errors({}).connectRequest);
  assert.ok(errors({}).from);
  assert.ok(errors({}).to);
  assert.ok(errors(valid({ fromRole: "admin" })).fromRole);
  assert.ok(errors(valid({ rating: 0 })).rating);
  assert.ok(errors(valid({ rating: 6 })).rating);
  assert.ok(errors(valid({ comment: "x".repeat(1001) })).comment);
  assert.equal(new Feedback(valid({ rating: 5 })).validateSync(), undefined);
});

test("indexes: unique per session/user/slot, plus session and receiver lookups", () => {
  const indexes = Feedback.schema.indexes();
  const unique = indexes.find(([, options]) => options?.unique);
  assert.deepEqual(unique[0], { connectRequest: 1, from: 1, slotIndex: 1 });
  assert.ok(
    indexes.some(([keys]) => keys.to === 1 && Object.keys(keys).length === 1),
  );
  assert.ok(
    indexes.some(
      ([keys]) => keys.connectRequest === 1 && Object.keys(keys).length === 1,
    ),
  );
});
