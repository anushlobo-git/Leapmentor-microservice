const createUserRepository = (User) => {
  const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const findUserByEmailWithPassword = (email) =>
    User.findOne({ email }).select("+password");

  const findUserByEmail = (email) => User.findOne({ email });

  const findUserById = (userId) =>
    User.findById(userId).select("-password");

  const findUsersByIds = (userIds) =>
    User.find({ _id: { $in: userIds } })
      .select("name email roles isEmailVerified")
      .sort({ name: 1 })
      .lean();

  const findUsersByRoleAndNameRegex = (name, roles = []) =>
    User.find({
      ...(roles.length > 0 && { roles: { $in: roles } }),
      name: { $regex: new RegExp(escapeRegex(name), "i") },
    })
      .select("name email roles isEmailVerified")
      .sort({ name: 1 })
      .limit(50)
      .lean();

  const findAdminUsers = async ({ search, role, page = 1, limit = 20, deleted }) => {
    const filter = {
      isDeleted: deleted === "true" ? true : { $ne: true },
      ...(role ? { roles: role } : {}),
    };

    if (search?.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: new RegExp(escaped, "i") } },
        { email: { $regex: new RegExp(escaped, "i") } },
      ];
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const query = User.find(filter)
      .setOptions({ ignoreIsDeleted: true })
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .select("-password")
      .lean();
    const countQuery = User.countDocuments(filter).setOptions({ ignoreIsDeleted: true });
    const [users, total] = await Promise.all([query, countQuery]);

    return {
      users,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  };

  const findAdminUserById = (userId) =>
    User.findById(userId)
      .setOptions({ ignoreIsDeleted: true })
      .select("-password");

  const updateAdminUserDeletedState = (userId, isDeleted) =>
    User.findByIdAndUpdate(
      userId,
      { $set: { isDeleted, deletedAt: isDeleted ? new Date() : null } },
      { returnDocument: "after", runValidators: true },
    ).setOptions({ ignoreIsDeleted: true });

  const countAdminUsers = (filter = {}) =>
    User.countDocuments({ isDeleted: { $ne: true }, ...filter }).setOptions({
      ignoreIsDeleted: true,
    });

  const getAdminUserGrowth = (since) =>
    User.aggregate([
      { $match: { isDeleted: { $ne: true }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

  const findUserByIdForAuthentication = (userId) =>
    User.findById(userId)
      .select("-password")
      .setOptions({ ignoreIsDeleted: true });

  const createUser = (data) => User.create(data);

  const addRoleToUser = (userId, role) =>
    User.findByIdAndUpdate(
      userId,
      { $addToSet: { roles: role } },
      { new: true, runValidators: true },
    );

  const saveUser = (user) => user.save();

  const updateWalletProvisioningStatus = (userId, status, error = null) =>
    User.findByIdAndUpdate(
      userId,
      {
        $set: {
          walletProvisioningStatus: status,
          walletProvisioningError: error,
          walletProvisioningUpdatedAt: new Date(),
        },
      },
      { new: true },
    );

  return {
    findUserByEmail,
    findUserById,
    findUsersByIds,
    findUsersByRoleAndNameRegex,
    findUserByIdForAuthentication,
    findUserByEmailWithPassword,
    createUser,
    addRoleToUser,
    saveUser,
    updateWalletProvisioningStatus,
    findAdminUsers,
    findAdminUserById,
    updateAdminUserDeletedState,
    countAdminUsers,
    getAdminUserGrowth,
  };
};

module.exports = createUserRepository;
