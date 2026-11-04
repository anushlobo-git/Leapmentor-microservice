// services/mentoring-workspace/repositories/milestone.repository.js

const createMilestoneRepository = (Milestone) => {
  const findAllByGoalSorted = (goalId) =>
    Milestone.find({ goal: goalId }).sort({ order: 1, createdAt: 1 }).lean();

  const findLastMilestone = (goalId) =>
    Milestone.findOne({ goal: goalId }).sort({ order: -1 }).lean();

  const create = (data) => Milestone.create(data);

  const findById = (id) => Milestone.findById(id);

  const save = (milestoneInstance) => milestoneInstance.save();

  const deleteById = (id) => Milestone.findByIdAndDelete(id);

  return {
    findAllByGoalSorted,
    findLastMilestone,
    create,
    findById,
    save,
    deleteById,
  };
};

module.exports = createMilestoneRepository;
