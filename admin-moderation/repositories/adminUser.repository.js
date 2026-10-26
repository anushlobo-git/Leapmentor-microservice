const createAdminUserRepository = (AdminUser) => ({
  findAdminByEmail: (email) => AdminUser.findOne({ email }).select("+password"),
  findAdminByIdFull: (id) => AdminUser.findById(id),
  findAdminByIdLean: (id) => AdminUser.findById(id).lean(),
  updateAdminById: (id, update) =>
    AdminUser.findByIdAndUpdate(id, { $set: update }, {
      returnDocument: "after",
      runValidators: true,
    }),
  createAdmin: (data) => AdminUser.create(data),
  saveAdmin: (admin) => admin.save(),
  incrementTokenVersion: (id) =>
    AdminUser.findByIdAndUpdate(
      id,
      { $inc: { tokenVersion: 1 } },
      { returnDocument: "after" },
    ),
});

module.exports = createAdminUserRepository;
