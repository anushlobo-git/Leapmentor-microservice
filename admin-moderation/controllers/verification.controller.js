const createVerificationController = ({ verificationService }) => ({
  list: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await verificationService.list(req.correlationId), message: "Mentor verifications retrieved" }); }
    catch (error) { return next(error); }
  },
  getById: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await verificationService.getById(req.params.mentorProfileId, req.correlationId), message: "Mentor verification retrieved" }); }
    catch (error) { return next(error); }
  },
  verify: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await verificationService.verify(req.params.mentorProfileId, req.correlationId), message: "Mentor verified" }); }
    catch (error) { return next(error); }
  },
  revoke: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await verificationService.revoke(req.params.mentorProfileId, req.correlationId), message: "Mentor verification revoked" }); }
    catch (error) { return next(error); }
  },
});

module.exports = createVerificationController;
