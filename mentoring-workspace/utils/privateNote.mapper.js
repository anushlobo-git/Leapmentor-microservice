// services/mentoring-workspace/utils/privateNote.mapper.js

/**
 * Safe DTO for a PrivateNote. Works on lean objects and Mongoose documents.
 * IDs are serialised to strings; no other fields leave the service.
 */
const toPrivateNoteDTO = (note) => {
  if (!note) return null;
  return {
    _id: note._id?.toString?.() || note._id,
    connectRequest:
      note.connectRequest?._id?.toString?.() ??
      note.connectRequest?.toString?.() ??
      note.connectRequest,
    author:
      note.author?._id?.toString?.() ??
      note.author?.toString?.() ??
      note.author,
    title: note.title || "Untitled Note",
    content: note.content || "",
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
};

module.exports = { toPrivateNoteDTO };
