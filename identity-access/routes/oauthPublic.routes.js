const express = require("express");

const createOAuthPublicRouter = ({ oauthController }) => {
  const router = express.Router();
  router.get("/linkedin", oauthController.linkedinRedirect);
  router.get("/linkedin/callback", oauthController.linkedinCallback);
  return router;
};

module.exports = createOAuthPublicRouter;
