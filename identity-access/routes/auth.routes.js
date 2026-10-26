const express = require("express");

const createAuthRouter = ({
  authController,
  refreshController,
  cookieService,
  oauthController,
  validations = {},
  includePublicOAuth = true,
}) => {
  const router = express.Router();

  router.post("/register", authController.register);
  router.post("/login", authController.login);
  router.post("/refresh", refreshController.refreshToken);
  router.post("/logout", (_req, res) => {
    cookieService.clearRefreshCookie(res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  });

  if (oauthController) {
    router.post(
      "/google",
      validations.googleValidation || ((_req, _res, next) => next()),
      oauthController.google,
    );
    router.post(
      "/social",
      validations.socialValidation || ((_req, _res, next) => next()),
      oauthController.social,
    );
    if (includePublicOAuth) {
      router.get("/linkedin", oauthController.linkedinRedirect);
      router.get("/linkedin/callback", oauthController.linkedinCallback);
    }
    router.post(
      "/linkedin/token",
      validations.linkedinValidation || ((_req, _res, next) => next()),
      oauthController.linkedinToken,
    );
  }

  return router;
};

module.exports = createAuthRouter;
