// services/mentoring-workspace/repositories/feedback.repository.js

/**
 * Data access for Feedback. Reads return lean objects with `from`/`to` as plain
 * IDs; the caller resolves names through Identity.
 */
const createFeedbackRepository = (Feedback) => {
  const findOne = (query) => Feedback.findOne(query).lean();

  const create = (data) => Feedback.create(data);

  const findAllByConnectRequest = (connectRequestId) =>
    Feedback.find({ connectRequest: connectRequestId })
      .sort({ createdAt: 1 })
      .lean();

  const findAllByTargetUser = (targetUserId) =>
    Feedback.find({ to: targetUserId }).lean();

  return { findOne, create, findAllByConnectRequest, findAllByTargetUser };
};

module.exports = createFeedbackRepository;
