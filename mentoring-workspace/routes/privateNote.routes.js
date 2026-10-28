// services/mentoring-workspace/routes/privateNote.routes.js
const express = require("express");

const createPrivateNoteRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();

  router.use(authenticate);

  // POST /api/v1/private-notes
  router.post("/", validations.validateCreate, controller.createNote);

  // GET /api/v1/private-notes/:connectRequestId
  router.get(
    "/:connectRequestId",
    validations.connectRequestIdParam,
    controller.getNotes,
  );

  // PATCH /api/v1/private-notes/:id
  router.patch("/:id", validations.validateUpdate, controller.updateNote);

  // DELETE /api/v1/private-notes/:id
  router.delete("/:id", validations.noteIdParam, controller.deleteNote);

  return router;
};

module.exports = createPrivateNoteRouter;
