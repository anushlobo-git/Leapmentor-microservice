// services/mentoring-workspace/utils/feedback.mapper.js

const idToString = (value) =>
  value?._id?.toString?.() ?? value?.toString?.() ?? value;

// With an Identity summary: an object carrying the ID as `_id` and `id` (the
// monolith sent `id`). Without one: the plain ID string.
const toParticipantField = (id, summary) =>
  summary ? { _id: id, id, name: summary.name, email: summary.email } : id;

/**
 * Safe DTO for a Feedback. `summaries` is a Map of user ID to Identity summary.
 */
const toFeedbackDTO = (feedback, summaries = new Map()) => {
  if (!feedback) return null;
  const from = idToString(feedback.from);
  const to = idToString(feedback.to);

  return {
    _id: idToString(feedback._id),
    connectRequest: idToString(feedback.connectRequest),
    from: toParticipantField(from, summaries.get(from)),
    to: toParticipantField(to, summaries.get(to)),
    fromRole: feedback.fromRole,
    rating: feedback.rating,
    comment: feedback.comment || "",
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
};

module.exports = { toFeedbackDTO };
