const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400, code: "INVALID_REPORT_REQUEST" });

const submitReportValidation = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.body?.connectRequestId || ""))) throw invalid("connectRequestId must be a valid ObjectId");
    if (typeof req.body?.complaintType !== "string" || !req.body.complaintType.trim()) throw invalid("complaintType is required");
    if (typeof req.body?.description !== "string" || req.body.description.trim().length < 10 || req.body.description.length > 1000) throw invalid("description must be 10 to 1000 characters");
    return next();
  } catch (error) { return next(error); }
};
const getMyReportValidation = (req, _res, next) => OBJECT_ID.test(String(req.params.connectRequestId || "")) ? next() : next(invalid("connectRequestId must be a valid ObjectId"));
module.exports = { submitReportValidation, getMyReportValidation };
