const jwt = require("jsonwebtoken");

const parseCookies = (header) =>
  Object.fromEntries(
    String(header || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value),
  );

const createAdminAuthenticate =
  ({ accessSecret, validateAdminToken }) =>
  async (req, res, next) => {
    const cookies = parseCookies(req.get("Cookie"));
    const token = cookies.adminToken;
    if (!token)
      return res
        .status(401)
        .json({
          message: "No admin token provided",
          code: "INVALID_ADMIN_TOKEN",
        });
    if (typeof validateAdminToken !== "function") {
      return res
        .status(503)
        .json({
          message: "Admin session validation is not configured",
          code: "ADMIN_VALIDATION_NOT_CONFIGURED",
        });
    }
    try {
      const payload = jwt.verify(token, accessSecret);
      if (payload.role !== "admin" || payload.type !== "access")
        throw new Error("Invalid admin token");
      req.admin = await validateAdminToken(token);
      if (!req.admin?._id)
        return res
          .status(401)
          .json({
            message: "Invalid or revoked admin token",
            code: "INVALID_ADMIN_TOKEN",
          });
      return next();
    } catch (error) {
      const statusCode =
        error.statusCode === 401 || error.statusCode === 403
          ? error.statusCode
          : error.statusCode
            ? 503
            : 401;
      return res.status(statusCode).json({
        message:
          statusCode === 503
            ? "Admin session validation is unavailable"
            : "Invalid or expired admin token",
        code: error.code || "INVALID_ADMIN_TOKEN",
      });
    }
  };

module.exports = createAdminAuthenticate;
