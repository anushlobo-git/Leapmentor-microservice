const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    connectRequest: { type: mongoose.Schema.Types.ObjectId, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ connectRequest: 1, createdAt: -1 });
messageSchema.index({ connectRequest: 1, sender: 1, readAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
