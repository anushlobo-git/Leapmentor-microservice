// services/mentoring-workspace/controllers/privateNote.controller.js

const createPrivateNoteController = ({ privateNoteService }) => {
  const createNote = async (req, res, next) => {
    try {
      const note = await privateNoteService.createPrivateNote(
        req.user._id,
        req.body,
      );
      return res
        .status(201)
        .json({
          success: true,
          data: { note },
          message: "Private note created",
        });
    } catch (error) {
      return next(error);
    }
  };

  const getNotes = async (req, res, next) => {
    try {
      const notes = await privateNoteService.getPrivateNotesList(
        req.params.connectRequestId,
        req.user._id,
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

  const updateNote = async (req, res, next) => {
    try {
      const note = await privateNoteService.updatePrivateNote(
        req.params.id,
        req.user._id,
        req.body,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { note },
          message: "Private note updated",
        });
    } catch (error) {
      return next(error);
    }
  };

  const deleteNote = async (req, res, next) => {
    try {
      await privateNoteService.removePrivateNote(req.params.id, req.user._id);
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

  return { createNote, getNotes, updateNote, deleteNote };
};

module.exports = createPrivateNoteController;
