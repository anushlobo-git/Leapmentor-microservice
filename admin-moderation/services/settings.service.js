const AppError = require("../utils/AppError");

const DEFAULT_COMMISSION_RATE = 20;

const createSettingsService = ({
  adminUserRepository,
  identityClient,
  workspaceClient,
  paymentsClient,
}) => {
  const getOverview = async (correlationId) => {
    const [identity, workspace] = await Promise.all([
      identityClient.getStats(correlationId),
      workspaceClient.getEngagementStats(correlationId),
    ]);
    return {
      totalUsers: identity?.data?.totalUsers || 0,
      activeSessions: workspace?.data?.ongoing || 0,
    };
  };

  const addAdmin = async ({ name, email }) => {
    const existing = await adminUserRepository.findAdminByEmail(email);
    if (existing) {
      throw new AppError("An administrator account with this email already exists.", 409, "ADMIN_EXISTS");
    }
    const temporaryPassword = `${require("node:crypto").randomBytes(9).toString("base64url")}A1!`;
    const admin = await adminUserRepository.createAdmin({
      name,
      email,
      password: temporaryPassword,
      isSuperAdmin: false,
      isActive: true,
    });
    return {
      temporaryPassword,
      admin: {
        _id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        isActive: admin.isActive,
      },
    };
  };

  const changePassword = async (adminId, { oldPassword, newPassword }) => {
    const admin = await adminUserRepository.findAdminByIdFull(adminId);
    if (!admin || !(await admin.comparePassword(oldPassword))) {
      throw new AppError("Current password is incorrect.", 401, "INVALID_CURRENT_PASSWORD");
    }
    admin.password = newPassword;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await adminUserRepository.saveAdmin(admin);
  };

  const getCommission = async (adminId, correlationId) => {
    try {
      const response = await paymentsClient.getCommission(correlationId);
      if (response?.data?.commissionRate !== undefined) return response.data.commissionRate;
    } catch {
      // Keep the Admin record as the local fallback for a temporarily unavailable Payments service.
    }
    const admin = await adminUserRepository.findAdminByIdLean(adminId);
    return admin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
  };

  const updateCommission = async (adminId, commissionRate, correlationId) => {
    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new AppError("Commission rate must be between 0 and 100.", 400, "INVALID_COMMISSION_RATE");
    }
    await paymentsClient.updateCommission(rate, correlationId);
    await adminUserRepository.updateAdminById(adminId, { commissionRate: rate });
    return rate;
  };

  return { getOverview, addAdmin, changePassword, getCommission, updateCommission };
};

module.exports = createSettingsService;
