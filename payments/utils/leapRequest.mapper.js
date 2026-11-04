const idToString = (value) =>
  value?._id?.toString?.() ?? value?.toString?.() ?? value;

const toLeapRequestDTO = (request) => {
  if (!request) return null;
  const mentee = request.mentee?._id
    ? {
        id: idToString(request.mentee._id),
        name: request.mentee.name,
        email: request.mentee.email,
        profilePicture: request.mentee.profilePicture,
      }
    : idToString(request.mentee);
  const reviewedBy = request.reviewedBy?._id
    ? { id: idToString(request.reviewedBy._id), name: request.reviewedBy.name }
    : idToString(request.reviewedBy);

  return {
    _id: idToString(request._id),
    mentee,
    status: request.status,
    currentBalance: request.currentBalance ?? 0,
    reviewedAt: request.reviewedAt || null,
    reviewedBy: reviewedBy || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

module.exports = { toLeapRequestDTO };
