const express = require("express");

const createSessionRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/:connectRequestId/slots", validations.requestId, controller.getSlots);
  router.patch("/:connectRequestId/slots/:slotIndex/meeting-link", validations.requestId, validations.slotIndex, validations.meetingLink, controller.setMeetingLink);
  router.patch("/:connectRequestId/slots/:slotIndex/mark-complete", validations.requestId, validations.slotIndex, controller.markSlotComplete);
  router.post("/:connectRequestId/add-slot", validations.requestId, validations.slotBody, controller.addSlot);
  router.patch("/:connectRequestId/slots/:slotIndex/cancel", validations.requestId, validations.slotIndex, controller.cancelSlot);
  router.patch("/:connectRequestId/slots/:slotIndex/reschedule", validations.requestId, validations.slotIndex, validations.slotBody, controller.rescheduleSlot);
  return router;
};

module.exports = createSessionRouter;
