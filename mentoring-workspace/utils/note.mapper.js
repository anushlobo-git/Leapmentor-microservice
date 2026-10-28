// services/mentoring-workspace/utils/note.mapper.js

const idToString = (value) =>
  value?._id?.toString?.() ?? value?.toString?.() ?? value;

/**
 * Builds the `uploadedBy` field.
 *
 * With an Identity summary it is an object that carries the ID under both `_id`
 * (what the frontend reads) and `id` (what the monolith sent), so existing
 * clients keep working. Without one, which happens when Identity could not be
 * reached or the account no longer exists, it is the plain ID string, a form
 * the frontend already handles.
 */
const toUploaderField = (uploaderId, uploader) => {
  if (!uploader) return uploaderId;
  return {
    _id: uploaderId,
    id: uploaderId,
    name: uploader.name,
    email: uploader.email,
  };
};

/**
 * Safe DTO for a Note. Works on lean objects and Mongoose documents; only the
 * listed fields leave the service.
 */
const toNoteDTO = (note, uploader = null) => {
  if (!note) return null;
  const uploaderId = idToString(note.uploadedBy);

  return {
    _id: idToString(note._id),
    connectRequest: idToString(note.connectRequest),
    uploadedBy: toUploaderField(uploaderId, uploader),
    uploaderRole: note.uploaderRole || "",
    title: note.title || "",
    fileUrl: note.fileUrl || "",
    publicId: note.publicId || "",
    fileType: note.fileType || "other",
    fileName: note.fileName || "",
    fileSize: note.fileSize ?? 0,
    isPrivate: note.isPrivate || false,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
};

module.exports = { toNoteDTO };
