// services/mentoring-workspace/repositories/note.repository.js

/**
 * Data access for shared and private file notes.
 *
 * Reads return lean objects with `uploadedBy` as a plain ID. Workspace has no
 * User model, so the caller resolves uploader names through Identity.
 */
const createNoteRepository = (Note) => {
  const create = (data) => Note.create(data);

  const findById = (id) => Note.findById(id).lean();

  const findSharedByConnectRequest = (connectRequestId) =>
    Note.find({
      connectRequest: connectRequestId,
      isPrivate: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();

  const findPrivateByConnectRequestAndUser = (connectRequestId, userId) =>
    Note.find({
      connectRequest: connectRequestId,
      uploadedBy: userId,
      isPrivate: true,
    })
      .sort({ createdAt: -1 })
      .lean();

  const deleteById = (id) => Note.findByIdAndDelete(id);

  return {
    create,
    findById,
    findSharedByConnectRequest,
    findPrivateByConnectRequestAndUser,
    deleteById,
  };
};

module.exports = createNoteRepository;
