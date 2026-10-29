const express = require("express");

const createInternalFinanceRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/invoices/:requestId", controller.getInvoiceContext);
  router.post("/invoice-email", controller.queueInvoiceEmail);
  router.post("/email-events", controller.queueEmailEvent);
  router.get("/mentors/:mentorId/sessions", controller.getMentorSessions);
  router.get("/mentors/:mentorId/payouts", controller.getPayouts);
  router.get("/mentors/:mentorId/rating", controller.getMentorRating);
  return router;
};

module.exports = createInternalFinanceRouter;
