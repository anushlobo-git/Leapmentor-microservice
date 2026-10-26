const AppError = require("../utils/AppError");

const createAdminAuthService = ({
  adminUserRepository,
  jwt,
  toAdminDTO,
  accessSecret,
  refreshSecret,
  accessExpiresIn = "15m",
  refreshExpiresIn = "7d",
}) => {
  const signAccessToken = (id, tokenVersion) =>
    jwt.sign(
      { id: id.toString(), role: "admin", type: "access", tokenVersion },
      accessSecret,
      { expiresIn: accessExpiresIn },
    );

  const signRefreshToken = (id, tokenVersion) =>
    jwt.sign(
      { id: id.toString(), role: "admin", type: "refresh", tokenVersion },
      refreshSecret,
      { expiresIn: refreshExpiresIn },
    );

  const adminLogin = async ({ email, password }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const admin = await adminUserRepository.findAdminByEmail(normalizedEmail);

    if (!admin) throw new AppError("Invalid credentials.", 401, "INVALID_CREDENTIALS");
    if (!admin.isActive) {
      throw new AppError("Admin account is deactivated.", 403, "ADMIN_INACTIVE");
    }

    const matches = await admin.comparePassword(password);
    if (!matches) {
      throw new AppError("Invalid credentials.", 401, "INVALID_CREDENTIALS");
    }

    admin.lastLoginAt = new Date();
    await adminUserRepository.saveAdmin(admin);

    const tokenVersion = admin.tokenVersion ?? 0;
    return {
      accessToken: signAccessToken(admin._id, tokenVersion),
      refreshToken: signRefreshToken(admin._id, tokenVersion),
      admin: toAdminDTO(admin),
    };
  };

  const refreshAdminToken = async (refreshToken) => {
    if (!refreshToken) {
      throw new AppError("No refresh token provided.", 401, "MISSING_REFRESH_TOKEN");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch {
      throw new AppError(
        "Invalid or expired refresh token.",
        401,
        "INVALID_REFRESH_TOKEN",
      );
    }

    if (decoded.role !== "admin" || decoded.type !== "refresh") {
      throw new AppError("Invalid refresh token.", 403, "INVALID_REFRESH_TOKEN");
    }

    const admin = await adminUserRepository.findAdminByIdFull(decoded.id);
    if (!admin) throw new AppError("Admin not found.", 401, "ADMIN_NOT_FOUND");
    if (!admin.isActive) {
      throw new AppError("Admin account is deactivated.", 403, "ADMIN_INACTIVE");
    }
    if (decoded.tokenVersion !== (admin.tokenVersion ?? 0)) {
      throw new AppError(
        "Session has been revoked. Please log in again.",
        401,
        "SESSION_REVOKED",
      );
    }

    return {
      accessToken: signAccessToken(admin._id, admin.tokenVersion ?? 0),
      refreshToken: signRefreshToken(admin._id, admin.tokenVersion ?? 0),
    };
  };

  const logout = async (refreshToken) => {
    if (!refreshToken) return;

    try {
      const decoded = jwt.verify(refreshToken, refreshSecret);
      await adminUserRepository.incrementTokenVersion(decoded.id);
    } catch {
      // Logout is intentionally idempotent for an already invalid session.
    }
  };

  return { adminLogin, refreshAdminToken, logout };
};

module.exports = createAdminAuthService;
