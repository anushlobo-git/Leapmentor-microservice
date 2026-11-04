const createAuthController = ({ authService, cookieService }) => {
  const setRefreshCookie = (res, token) => {
    if (cookieService?.setRefreshCookie) {
      cookieService.setRefreshCookie(res, token);
      return;
    }

    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  };

  const register = async (req, res, next) => {
    try {
      const result = await authService.registerUser(req.body, {
        correlationId: req.correlationId,
      });

      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
      }

      const status = result.outcome === "created" ? 201 : 200;
      return res.status(status).json({
        success: true,
        data: {
          outcome: result.outcome,
          isNewUser: result.isNewUser,
          loggedIn: result.loggedIn,
          user: result.user,
          accessToken: result.accessToken,
          email: result.email,
        },
        message:
          result.outcome === "role_added"
            ? "Role added to your account"
            : result.outcome === "already_registered"
              ? "You already have an account for this role"
              : result.outcome === "login_required"
                ? "An account with this email already exists"
                : "Registered successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  const login = async (req, res, next) => {
    try {
      const result = await authService.loginUser(req.body);

      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
      }

      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
        message: "Login successful",
      });
    } catch (error) {
      return next(error);
    }
  };

  const logout = async (_req, res, next) => {
    try {
      if (cookieService?.clearRefreshCookie) {
        cookieService.clearRefreshCookie(res);
      } else {
        res.clearCookie("refreshToken");
      }

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { register, login, logout };
};

module.exports = createAuthController;
