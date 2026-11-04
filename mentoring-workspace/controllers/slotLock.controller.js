const createSlotLockController = ({ slotLockService }) => ({
  lock: async (req, res, next) => {
    try {
      const result = await slotLockService.acquireSlotLock(req.user._id, req.body);
      return res.status(200).json({ success: true, data: result, message: "Slot locked successfully" });
    } catch (error) { return next(error); }
  },
  unlock: async (req, res, next) => {
    try {
      await slotLockService.releaseSlotLock(req.user._id, req.body);
      return res.status(200).json({ success: true, data: null, message: "Slot unlocked successfully" });
    } catch (error) { return next(error); }
  },
  unlockAll: async (req, res, next) => {
    try {
      await slotLockService.releaseAllUserLocks(req.user._id, req.body?.mentorId);
      return res.status(200).json({ success: true, data: null, message: "All locks released successfully" });
    } catch (error) { return next(error); }
  },
  active: async (req, res, next) => {
    try {
      const result = await slotLockService.getMentorActiveLocks(req.params.mentorId, req.user._id);
      return res.status(200).json({ success: true, data: result, message: "Active slot locks retrieved" });
    } catch (error) { return next(error); }
  },
});

module.exports = createSlotLockController;
