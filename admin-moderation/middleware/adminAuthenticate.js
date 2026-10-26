const AppError = require("../utils/AppError");

const createAdminAuthenticate = ({
  adminUserRepository,
  jwt,
  accessSecret,
  toAdminDTO,
}) => async (req, _res, next) => {
  const token = req.cookies?.adminToken;
  if (!token) return next(new AppError("No token provided.", 401, "INVALID_ADMIN_TOKEN"));

  let decoded;
  try {
    decoded = jwt.verify(token, accessSecret);
  } catch {
    return next(
      new AppError("Invalid or expired token.", 401, "INVALID_ADMIN_TOKEN"),
    );
  }

  if (decoded.role !== "admin" || decoded.type !== "access") {
    return next(
      new AppError(
        "Access denied: not a valid admin access token.",
        403,
        "INVALID_ADMIN_TOKEN",
      ),
    );
  }

  try {
    const admin = await adminUserRepository.findAdminByIdFull(decoded.id);
    if (!admin) {
      return next(new AppError("Admin not found.", 401, "ADMIN_NOT_FOUND"));
    }
    if (!admin.isActive) {
      return next(
        new AppError("Admin account is deactivated.", 403, "ADMIN_INACTIVE"),
      );
    }
    if (decoded.tokenVersion !== (admin.tokenVersion ?? 0)) {
      return next(
        new AppError(
          "Session has been revoked. Please log in again.",
          401,
          "SESSION_REVOKED",
        ),
      );
    }

    req.admin = toAdminDTO(admin);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = createAdminAuthenticate;
