const createOAuthController = ({
  googleAuthService,
  linkedinAuthService,
  federatedAuthService,
  cookieService,
  oauthStateService,
  clientId,
  callbackUrl,
  clientUrl,
  logger = console,
}) => {
  const setSession = (res, result, message) => {
    cookieService.setRefreshCookie(res, result.refreshToken);
    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        isNewUser: result.isNewUser,
      },
      message,
    });
  };

  const google = async (req, res, next) => {
    try {
      const result = await googleAuthService.googleAuthUser(
        req.body,
        { correlationId: req.correlationId },
      );
      return setSession(res, result, "Google login successful");
    } catch (error) {
      return next(error);
    }
  };

  const social = async (req, res, next) => {
    try {
      const result = await federatedAuthService.socialAuthUser(
        req.body,
        { correlationId: req.correlationId },
      );
      return setSession(res, result, "Social login successful");
    } catch (error) {
      logger.warn?.("Generic social authentication failed", {
        provider: req.body?.provider,
        error: error.message,
      });
      return next(error);
    }
  };

  const linkedinRedirect = (req, res) => {
    if (!clientId || !callbackUrl) {
      return res.status(503).json({
        error: "LinkedIn authentication is not configured",
        code: "LINKEDIN_NOT_CONFIGURED",
      });
    }

    const state = oauthStateService.signState({
      role: req.query.role || null,
      termsAccepted: req.query.termsAccepted === "true",
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: "openid profile email",
      state,
    });
    return res.redirect(
      `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
    );
  };

  const linkedinCallback = (req, res) => {
    const { code, state, error } = req.query;
    const frontendBase = String(clientUrl).replace(/\/$/, "");

    if (error || !code) {
      return res.redirect(`${frontendBase}/?linkedin=failure`);
    }

    try {
      oauthStateService.verifyState(state);
    } catch (stateError) {
      logger.warn?.("LinkedIn OAuth state verification failed", {
        error: stateError.message,
      });
      return res.redirect(
        `${frontendBase}/?linkedin=failure&reason=invalid_state`,
      );
    }

    const params = new URLSearchParams({
      code,
      state,
      provider: "linkedin",
    });
    return res.redirect(`${frontendBase}/sso-callback?${params.toString()}`);
  };

  const linkedinToken = async (req, res, next) => {
    try {
      const result = await linkedinAuthService.exchangeLinkedinCode(
        req.body,
        { correlationId: req.correlationId },
      );
      return setSession(res, result, "LinkedIn login successful");
    } catch (error) {
      return next(error);
    }
  };

  return { google, social, linkedinRedirect, linkedinCallback, linkedinToken };
};

module.exports = createOAuthController;
