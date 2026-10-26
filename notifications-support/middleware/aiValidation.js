const validateChat = (req, _res, next) => {
  const body = req.body || {};
  const messagesValid = Array.isArray(body.messages) && body.messages.every((message) => ["user", "assistant", "system"].includes(message?.role) && typeof message.content === "string" && message.content.trim());
  if (!messagesValid || (body.systemPrompt !== undefined && typeof body.systemPrompt !== "string") || String(body.systemPrompt || "").length > 8000) {
    const error = new Error("Invalid AI chat payload");
    error.statusCode = 400;
    error.code = "INVALID_AI_CHAT_PAYLOAD";
    return next(error);
  }
  return next();
};

module.exports = { validateChat };
