const AppError = require("../utils/AppError");

const createInternalAdminAuthController = ({
  adminUserRepository,
  jwt,
  accessSecret,
  toAdminDTO,
}) => ({
  validateSession: async (req, res, next) => {
    const token = req.body?.token;
    if (!token)
      return next(
        new AppError(
          "Admin access token is required",
          400,
          "ADMIN_TOKEN_REQUIRED",
        ),
      );
    let decoded;
    try {
      decoded = jwt.verify(token, accessSecret);
    } catch {
      return next(
        new AppError(
          "Invalid or expired admin token",
          401,
          "INVALID_ADMIN_TOKEN",
        ),
      );
    }
    if (decoded.role !== "admin" || decoded.type !== "access" || !decoded.id) {
      return next(
        new AppError("Invalid admin access token", 401, "INVALID_ADMIN_TOKEN"),
      );
    }
    try {
      const admin = await adminUserRepository.findAdminByIdFull(decoded.id);
      if (!admin)
        return next(new AppError("Admin not found", 401, "ADMIN_NOT_FOUND"));
      if (!admin.isActive)
        return next(
          new AppError("Admin account is deactivated", 403, "ADMIN_INACTIVE"),
        );
      if (decoded.tokenVersion !== (admin.tokenVersion ?? 0)) {
        return next(
          new AppError(
            "Admin session has been revoked",
            401,
            "SESSION_REVOKED",
          ),
        );
      }
      return res
        .status(200)
        .json({ success: true, data: { admin: toAdminDTO(admin) } });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalAdminAuthController;
