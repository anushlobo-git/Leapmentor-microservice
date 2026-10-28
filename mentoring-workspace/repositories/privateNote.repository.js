// services/mentoring-workspace/repositories/privateNote.repository.js

const createPrivateNoteRepository = (PrivateNote) => {
  const create = (data) => PrivateNote.create(data);

  const findBySessionAndAuthor = (connectRequestId, authorId) =>
    PrivateNote.find({ connectRequest: connectRequestId, author: authorId })
      .sort({ updatedAt: -1 })
      .lean();

  const findById = (id) => PrivateNote.findById(id);

  const save = (noteDocument) => noteDocument.save();

  const deleteById = (id) => PrivateNote.findByIdAndDelete(id);

  return { create, findBySessionAndAuthor, findById, save, deleteById };
};

module.exports = createPrivateNoteRepository;
