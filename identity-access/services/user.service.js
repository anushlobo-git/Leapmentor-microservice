const { toUserDTO } = require("../utils/user.mapper");

const createUserService = () => {
  const getCurrentUser = (user) => toUserDTO(user);

  return {
    getCurrentUser,
  };
};

module.exports = createUserService;
