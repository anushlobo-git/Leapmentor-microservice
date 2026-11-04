const createAuthController = ({ authService }) => {
  const baseCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };
  const accessCookieOptions = { ...baseCookieOptions, maxAge: 15 * 60 * 1000 };
  const refreshCookieOptions = {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/admin/auth",
  };

  const login = async (req, res, next) => {
    try {
      const result = await authService.adminLogin(req.body);
      res.cookie("adminToken", result.accessToken, accessCookieOptions);
      res.cookie("adminRefreshToken", result.refreshToken, refreshCookieOptions);
      return res.status(200).json({
        success: true,
        data: { admin: result.admin },
        message: "Admin login successful",
      });
    } catch (error) {
      return next(error);
    }
  };

  const refresh = async (req, res, next) => {
    try {
      const result = await authService.refreshAdminToken(
        req.cookies?.adminRefreshToken,
      );
      res.cookie("adminToken", result.accessToken, accessCookieOptions);
      res.cookie("adminRefreshToken", result.refreshToken, refreshCookieOptions);
      return res.status(200).json({
        success: true,
        data: null,
        message: "Session refreshed",
      });
    } catch (error) {
      return next(error);
    }
  };

  const logout = async (req, res, next) => {
    try {
      await authService.logout(req.cookies?.adminRefreshToken);
      res.clearCookie("adminToken", baseCookieOptions);
      res.clearCookie("adminRefreshToken", {
        ...baseCookieOptions,
        path: "/api/v1/admin/auth",
      });
      return res.status(200).json({
        success: true,
        data: null,
        message: "Logged out.",
      });
    } catch (error) {
      return next(error);
    }
  };

  const me = (req, res) =>
    res.status(200).json({
      success: true,
      data: { admin: req.admin },
      message: "Admin profile retrieved",
    });

  return { login, refresh, logout, me };
};

module.exports = createAuthController;
