// services/mentoring-workspace/services/note.service.js
const AppError = require("../utils/AppError");
const { toNoteDTO } = require("../utils/note.mapper");

const ALLOWED_SESSION_STATUSES = new Set(["ongoing", "completed"]);
const ROLE_MENTOR = "mentor";
const ROLE_MENTEE = "mentee";

const defaultLogger = {
  warn: (message, meta = {}) =>
    process.stderr.write(
      `${JSON.stringify({ level: "warn", service: "mentoring-workspace", message, ...meta })}\n`,
    ),
};

/**
 * Shared and private file notes.
 *
 * Workspace owns the Note records and the participant check. Cloudinary stores
 * the bytes and Identity supplies the uploader's name; both are injected, so a
 * failed Identity lookup degrades the response (plain `uploadedBy` ID) instead
 * of failing it.
 */
const createNoteService = ({
  noteRepository,
  connectRequestRepository,
  cloudinaryClient,
  identityClient,
  getFileType,
  logger = defaultLogger,
}) => {
  const _verifySessionAccess = async (connectRequestId, userId) => {
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
    const isMentor = String(mentorId) === identity;
    const isMentee = String(menteeId) === identity;
    if (!isMentor && !isMentee) {
      throw new AppError(
        "You are not a participant of this session",
        403,
        "NOT_SESSION_PARTICIPANT",
      );
    }

    return {
      uploaderRole: isMentor ? ROLE_MENTOR : ROLE_MENTEE,
      sessionStatus: request.status,
    };
  };

  // Resolves uploader names in one Identity call. Never throws.
  const _loadUploaders = async (notes, correlationId) => {
    try {
      return await identityClient.getUserSummaryMap(
        notes.map((note) => note.uploadedBy),
        correlationId,
      );
    } catch (error) {
      logger.warn(
        "Identity lookup failed; returning notes without uploader names",
        {
          correlationId,
          reason: error.message,
        },
      );
      return new Map();
    }
  };

  const _toDTOs = async (notes, correlationId) => {
    if (notes.length === 0) return [];
    const uploaders = await _loadUploaders(notes, correlationId);
    return notes.map((note) =>
      toNoteDTO(note, uploaders.get(String(note.uploadedBy)) || null),
    );
  };

  const _destroyAssetQuietly = async (publicId, context) => {
    try {
      await cloudinaryClient.destroyRawAsset(publicId);
    } catch (error) {
      logger.warn("Cloudinary asset cleanup failed; asset may be orphaned", {
        ...context,
        publicId,
        reason: error.message,
      });
    }
  };

  const processNoteUpload = async (
    connectRequestId,
    userId,
    filePayload,
    inputFields = {},
    correlationId,
  ) => {
    if (!connectRequestId) {
      throw new AppError(
        "connectRequestId is required",
        400,
        "CONNECT_REQUEST_REQUIRED",
      );
    }
    if (!filePayload) {
      throw new AppError("A file is required", 400, "NOTE_FILE_REQUIRED");
    }

    const access = await _verifySessionAccess(connectRequestId, userId);
    if (access.sessionStatus === "completed") {
      throw new AppError(
        "Uploading notes to a completed session is disabled",
        400,
        "SESSION_COMPLETED",
      );
    }

    const isPrivate =
      inputFields.isPrivate === true || inputFields.isPrivate === "true";

    let uploaded;
    try {
      uploaded = await cloudinaryClient.uploadRawBuffer(filePayload.buffer, {
        folder: `leapmentor/notes/${connectRequestId}`,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.warn("Cloudinary upload failed", {
        correlationId,
        connectRequestId,
        reason: error.message,
      });
      throw new AppError(
        "The file storage provider could not store the upload",
        502,
        "UPLOAD_PROVIDER_FAILED",
      );
    }

    let note;
    try {
      note = await noteRepository.create({
        connectRequest: connectRequestId,
        uploadedBy: userId,
        uploaderRole: access.uploaderRole,
        title: inputFields.title?.trim() || filePayload.originalname,
        fileUrl: uploaded.url,
        publicId: uploaded.publicId,
        fileType: getFileType(filePayload.mimetype),
        fileName: filePayload.originalname,
        fileSize: filePayload.size,
        isPrivate,
      });
    } catch (error) {
      // The asset was stored but no record points at it; remove it.
      await _destroyAssetQuietly(uploaded.publicId, {
        correlationId,
        connectRequestId,
      });
      throw error;
    }

    const [dto] = await _toDTOs([note], correlationId);
    return dto;
  };

  const getSharedNotesList = async (
    connectRequestId,
    userId,
    correlationId,
  ) => {
    await _verifySessionAccess(connectRequestId, userId);
    const notes =
      await noteRepository.findSharedByConnectRequest(connectRequestId);
    return _toDTOs(notes, correlationId);
  };

  const getPrivateNotesList = async (
    connectRequestId,
    userId,
    correlationId,
  ) => {
    await _verifySessionAccess(connectRequestId, userId);
    const notes = await noteRepository.findPrivateByConnectRequestAndUser(
      connectRequestId,
      userId,
    );
    return _toDTOs(notes, correlationId);
  };

  const removeNoteRecord = async (noteId, userId, correlationId) => {
    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new AppError("Note not found", 404, "NOTE_NOT_FOUND");
    }
    if (String(note.uploadedBy) !== String(userId)) {
      throw new AppError(
        "You can only delete your own notes",
        403,
        "NOT_NOTE_UPLOADER",
      );
    }

    // Record first: a failure here leaves the file and the note intact. If the
    // asset cleanup then fails, only an unreferenced file remains (logged).
    await noteRepository.deleteById(noteId);
    await _destroyAssetQuietly(note.publicId, { correlationId, noteId });
  };

  return {
    processNoteUpload,
    getSharedNotesList,
    getPrivateNotesList,
    removeNoteRecord,
  };
};

module.exports = createNoteService;
