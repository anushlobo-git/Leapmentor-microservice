const toUserDTO = (user) => ({
  _id: user._id?.toString?.() || user._id,
  name: user.name || "",
  email: user.email || "",
  roles: user.roles || [],
  isEmailVerified: user.isEmailVerified || false,
  termsAccepted: user.termsAccepted || false,
  termsAcceptedAt: user.termsAcceptedAt || null,
  passwordChangedAt: user.passwordChangedAt || null,
  isDeleted: user.isDeleted || false,
  deletedAt: user.deletedAt || null,
  walletProvisioningStatus: user.walletProvisioningStatus || "pending",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = { toUserDTO };
