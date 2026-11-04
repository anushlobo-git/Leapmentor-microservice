const addRoleValidation = (req, _res, next) => {
  if (!["mentor", "mentee"].includes(req.body?.role)) {
    const error = new Error("Role must be mentor or mentee.");
    error.statusCode = 400;
    error.code = "INVALID_ROLE";
    return next(error);
  }
  return next();
};

module.exports = { addRoleValidation };
