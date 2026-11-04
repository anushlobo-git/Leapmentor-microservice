// services/mentoring-workspace/controllers/note.controller.js

const createNoteController = ({ noteService }) => {
  const uploadNote = async (req, res, next) => {
    try {
      const note = await noteService.processNoteUpload(
        req.body?.connectRequestId,
        req.user._id,
        req.file,
        req.body || {},
        req.correlationId,
      );
      return res
        .status(201)
        .json({
          success: true,
          data: { note },
          message: "Note uploaded successfully",
        });
    } catch (error) {
      return next(error);
    }
  };

  const getNotes = async (req, res, next) => {
    try {
      const notes = await noteService.getSharedNotesList(
        req.params.connectRequestId,
        req.user._id,
        req.correlationId,
      );
      return res
        .status(200)
        .json({ success: true, data: { notes }, message: "Notes retrieved" });
    } catch (error) {
      return next(error);
    }
  };

  const getPrivateNotes = async (req, res, next) => {
    try {
      const notes = await noteService.getPrivateNotesList(
        req.params.connectRequestId,
        req.user._id,
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { notes },
          message: "Private notes retrieved",
        });
    } catch (error) {
      return next(error);
    }
  };

  const deleteNote = async (req, res, next) => {
    try {
      await noteService.removeNoteRecord(
        req.params.id,
        req.user._id,
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: null,
          message: "Note deleted successfully",
        });
    } catch (error) {
      return next(error);
    }
  };

  return { uploadNote, getNotes, getPrivateNotes, deleteNote };
};

module.exports = createNoteController;
