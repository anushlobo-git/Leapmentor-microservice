const AppError = require("../utils/AppError");

const createUserManagementService = ({
  identityClient,
  profileClient,
  workspaceClient,
}) => {
  const enrichUsers = async (users, correlationId) => {
    if (users.length === 0) return users.map((user) => ({ ...user, profile: null }));
    const response = await profileClient.getProfiles(
      users.map((user) => user._id),
      correlationId,
    );
    const profiles = new Map(
      (response?.data?.profiles || []).map(({ userId, profile }) => [userId, profile]),
    );
    return users.map((user) => ({ ...user, profile: profiles.get(user._id) || null }));
  };

  const getUsers = async (query, correlationId) => {
    const response = await identityClient.listUsers(query, correlationId);
    const users = response?.data?.users || [];
    return {
      users: await enrichUsers(users, correlationId),
      pagination: response?.data?.pagination || {
        total: users.length,
        page: Number(query.page || 1),
        limit: Number(query.limit || 20),
        totalPages: users.length ? 1 : 0,
      },
    };
  };

  const getUserDetail = async (userId, correlationId) => {
    const [userResponse, profileResponse, sessionResponse] = await Promise.all([
      identityClient.getUser(userId, correlationId),
      profileClient.getProfiles([userId], correlationId),
      workspaceClient.getCompletedSessionCount(userId, correlationId),
    ]);
    const user = userResponse?.data?.user;
    if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");

    return {
      user,
      profile: profileResponse?.data?.profiles?.[0]?.profile || null,
      sessionCount: sessionResponse?.data?.sessionCount || 0,
    };
  };

  const blockUser = async (userId, correlationId) => {
    const response = await identityClient.blockUser(userId, correlationId);
    const user = response?.data?.user;
    if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    return { name: user.name, user };
  };

  const unblockUser = async (userId, correlationId) => {
    const response = await identityClient.unblockUser(userId, correlationId);
    const user = response?.data?.user;
    if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    return { name: user.name, user };
  };

  return { getUsers, getUserDetail, blockUser, unblockUser };
};

module.exports = createUserManagementService;
