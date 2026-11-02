const test = require("node:test");
const assert = require("node:assert/strict");

const { toMessageDTO } = require("../../utils/message.mapper");

test("serializes message references and applies empty content and read defaults", () => {
  const dto = toMessageDTO({
    _id: { toString: () => "message-1" },
    connectRequest: { toString: () => "request-1" },
    sender: "user-1",
    content: "",
  });
  assert.equal(dto._id, "message-1");
  assert.equal(dto.connectRequest, "request-1");
  assert.equal(dto.sender, "user-1");
  assert.equal(dto.content, "");
  assert.equal(dto.readAt, null);

  const empty = toMessageDTO({});
  assert.equal(empty._id, undefined);
  assert.equal(empty.connectRequest, undefined);
  assert.equal(empty.sender, undefined);
});
