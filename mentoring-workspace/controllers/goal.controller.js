// services/mentoring-workspace/controllers/goal.controller.js

const createGoalController = ({ goalService }) => {
  const createGoal = async (req, res, next) => {
    try {
      const goal = await goalService.createGoal({
        connectRequestId: req.body.connectRequestId,
        title: req.body.title,
        description: req.body.description,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        userId: req.user._id,
      });
      return res.status(201).json({ success: true, data: { goal }, message: "Goal created" });
    } catch (error) {
      return next(error);
    }
  };

  const getGoal = async (req, res, next) => {
    try {
      const result = await goalService.getGoalByConnection(
        req.params.connectRequestId,
        req.user._id,
      );
      return res.status(200).json({ success: true, data: result, message: "Goal retrieved" });
    } catch (error) {
      return next(error);
    }
  };

  const updateGoal = async (req, res, next) => {
    try {
      const goal = await goalService.updateGoal({
        goalId: req.params.goalId,
        title: req.body.title,
        description: req.body.description,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: req.body.status,
        userId: req.user._id,
      });
      return res.status(200).json({ success: true, data: { goal }, message: "Goal updated" });
    } catch (error) {
      return next(error);
    }
  };

  const createMilestone = async (req, res, next) => {
    try {
      const milestone = await goalService.createMilestone({
        goalId: req.params.goalId,
        title: req.body.title,
        description: req.body.description,
        dueDate: req.body.dueDate,
        userId: req.user._id,
      });
      return res.status(201).json({ success: true, data: { milestone }, message: "Milestone created" });
    } catch (error) {
      return next(error);
    }
  };

  const updateMilestone = async (req, res, next) => {
    try {
      const milestone = await goalService.updateMilestone({
        milestoneId: req.params.milestoneId,
        title: req.body.title,
        description: req.body.description,
        isCompleted: req.body.isCompleted,
        userId: req.user._id,
      });
      return res.status(200).json({ success: true, data: { milestone }, message: "Milestone updated" });
    } catch (error) {
      return next(error);
    }
  };

  const deleteMilestone = async (req, res, next) => {
    try {
      const milestoneId = await goalService.deleteMilestone(
        req.params.milestoneId,
        req.user._id,
      );
      return res.status(200).json({ success: true, data: { milestoneId }, message: "Milestone deleted" });
    } catch (error) {
      return next(error);
    }
  };

  return {
    createGoal,
    getGoal,
    updateGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  };
};

module.exports = createGoalController;
