const createAiController = ({ aiService }) => ({
  handleChat: async (req, res, next) => {
    try {
      const text = await aiService.generateChatResponse(req.body.messages, req.body.systemPrompt);
      return res.status(200).json({ success: true, data: { content: [{ type: "text", text }] }, message: "Chat response generated" });
    } catch (error) { return next(error); }
  },
});

module.exports = createAiController;
