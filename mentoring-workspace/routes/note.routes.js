// services/mentoring-workspace/routes/note.routes.js
const express = require("express");

const createNoteRouter = ({
  controller,
  authenticate,
  upload,
  validations,
}) => {
  const router = express.Router();

  router.use(authenticate);

  // POST /api/v1/notes/upload  (multipart: file, connectRequestId, title?, isPrivate?)
  router.post(
    "/upload",
    upload,
    validations.validateUpload,
    controller.uploadNote,
  );

  // GET /api/v1/notes/:connectRequestId/private (registered before the shorter path)
  router.get(
    "/:connectRequestId/private",
    validations.connectRequestIdParam,
    controller.getPrivateNotes,
  );

  // GET /api/v1/notes/:connectRequestId
  router.get(
    "/:connectRequestId",
    validations.connectRequestIdParam,
    controller.getNotes,
  );

  // DELETE /api/v1/notes/:id
  router.delete("/:id", validations.noteIdParam, controller.deleteNote);

  return router;
};

module.exports = createNoteRouter;
