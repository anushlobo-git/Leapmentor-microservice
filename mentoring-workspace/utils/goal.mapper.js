// services/mentoring-workspace/utils/goal.mapper.js

/**
 * Safe DTO for a Goal document.
 * Works on both lean objects and Mongoose documents.
 */
const toGoalDTO = (goal) => ({
  _id: goal._id?.toString?.() || goal._id,
  connectRequest: goal.connectRequest?.toString?.() || goal.connectRequest,
  mentor: goal.mentor?.toString?.() || goal.mentor,
  mentee: goal.mentee?.toString?.() || goal.mentee,
  title: goal.title,
  description: goal.description,
  startDate: goal.startDate,
  endDate: goal.endDate,
  status: goal.status,
  createdBy: goal.createdBy?.toString?.() || goal.createdBy,
  createdAt: goal.createdAt,
  updatedAt: goal.updatedAt,
});

/**
 * Safe DTO for a Milestone document.
 * Works on both lean objects and Mongoose documents.
 */
const toMilestoneDTO = (milestone) => ({
  _id: milestone._id?.toString?.() || milestone._id,
  goal: milestone.goal?.toString?.() || milestone.goal,
  connectRequest: milestone.connectRequest?.toString?.() || milestone.connectRequest,
  title: milestone.title,
  description: milestone.description,
  dueDate: milestone.dueDate,
  isCompleted: milestone.isCompleted,
  completedAt: milestone.completedAt,
  completedBy: milestone.completedBy?.toString?.() || milestone.completedBy,
  order: milestone.order,
  slotIndex: milestone.slotIndex,
  createdAt: milestone.createdAt,
  updatedAt: milestone.updatedAt,
});

module.exports = { toGoalDTO, toMilestoneDTO };
