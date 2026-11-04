const toAdminDTO = (admin) => ({
  _id: admin._id?.toString?.() || admin._id,
  name: admin.name,
  email: admin.email,
  isSuperAdmin: admin.isSuperAdmin,
  isActive: admin.isActive,
  lastLoginAt: admin.lastLoginAt,
  commissionRate: admin.commissionRate,
  walletBalance: admin.walletBalance,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
});

module.exports = { toAdminDTO };
