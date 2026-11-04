// services/mentoring-workspace/services/privateNote.service.js
const AppError = require("../utils/AppError");
const { toPrivateNoteDTO } = require("../utils/privateNote.mapper");

const ALLOWED_SESSION_STATUSES = new Set(["ongoing", "completed"]);
const DEFAULT_NOTE_TITLE = "Untitled Note";

/**
 * Private (text) notes are visible only to their author. The service owns the
 * participant check; it reads the connect request through the Workspace
 * repository and never calls another service.
 */
const createPrivateNoteService = ({
  privateNoteRepository,
  connectRequestRepository,
}) => {
  const _verifySessionParticipant = async (connectRequestId, userId) => {
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request) {
      throw new AppError("Target session not found", 404, "SESSION_NOT_FOUND");
    }
    if (!ALLOWED_SESSION_STATUSES.has(request.status)) {
      throw new AppError(
        "Cannot manage notes for an inactive session",
        400,
        "SESSION_INACTIVE",
      );
    }

    const identity = String(userId);
    const mentorId = request.mentor?._id ?? request.mentor;
    const menteeId = request.mentee?._id ?? request.mentee;
    if (String(mentorId) !== identity && String(menteeId) !== identity) {
      throw new AppError(
        "You are not a participant of this session",
        403,
        "NOT_SESSION_PARTICIPANT",
      );
    }
  };

  const _findOwnedNote = async (noteId, userId, action) => {
    const note = await privateNoteRepository.findById(noteId);
    if (!note) {
      throw new AppError(
        "Private note not found",
        404,
        "PRIVATE_NOTE_NOT_FOUND",
      );
    }
    if (String(note.author) !== String(userId)) {
      throw new AppError(
        `You can only ${action} your own private notes`,
        403,
        "NOT_NOTE_AUTHOR",
      );
    }
    return note;
  };

  const createPrivateNote = async (
    userId,
    { connectRequestId, title, content } = {},
  ) => {
    if (!connectRequestId) {
      throw new AppError(
        "connectRequestId is required",
        400,
        "CONNECT_REQUEST_REQUIRED",
      );
    }
    await _verifySessionParticipant(connectRequestId, userId);

    const note = await privateNoteRepository.create({
      connectRequest: connectRequestId,
      author: userId,
      title: title?.trim() || DEFAULT_NOTE_TITLE,
      content: content || "",
    });
    return toPrivateNoteDTO(note);
  };

  const getPrivateNotesList = async (connectRequestId, userId) => {
    await _verifySessionParticipant(connectRequestId, userId);
    const notes = await privateNoteRepository.findBySessionAndAuthor(
      connectRequestId,
      userId,
    );
    return notes.map(toPrivateNoteDTO);
  };

  const updatePrivateNote = async (noteId, userId, updateData = {}) => {
    const note = await _findOwnedNote(noteId, userId, "edit");

    if (updateData.title !== undefined) {
      note.title = updateData.title.trim() || DEFAULT_NOTE_TITLE;
    }
    if (updateData.content !== undefined) {
      note.content = updateData.content;
    }

    const saved = await privateNoteRepository.save(note);
    return toPrivateNoteDTO(saved);
  };

  const removePrivateNote = async (noteId, userId) => {
    await _findOwnedNote(noteId, userId, "delete");
    await privateNoteRepository.deleteById(noteId);
  };

  return {
    createPrivateNote,
    getPrivateNotesList,
    updatePrivateNote,
    removePrivateNote,
  };
};

module.exports = createPrivateNoteService;
