const express = require("express");

const createConnectRequestRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/", validations.validateCreate, controller.send);
  router.get("/my-requests", controller.myRequests);
  router.get("/incoming", controller.incoming);
  router.get("/ongoing", controller.ongoing);
  router.get("/:id/detail", validations.validateId, controller.detail);
  router.patch("/:id", validations.validateResponse, controller.respond);
  router.delete("/:id", validations.validateId, controller.cancel);
  return router;
};

module.exports = createConnectRequestRouter;
