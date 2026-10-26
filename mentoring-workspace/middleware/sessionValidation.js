const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const invalid = (message) => { const error = new Error(message); error.statusCode = 400; error.code = "INVALID_SESSION_REQUEST"; return error; };
const requestId = (req, _res, next) => OBJECT_ID.test(String(req.params.connectRequestId || "")) ? next() : next(invalid("connectRequestId must be a valid ObjectId"));
const slotIndex = (req, _res, next) => { if (!/^[0-9]+$/.test(String(req.params.slotIndex || ""))) return next(invalid("slotIndex must be a non-negative integer")); return next(); };
const slotBody = (req, _res, next) => { const { date, startTime, endTime } = req.body || {}; if (!DATE.test(String(date || "")) || !TIME.test(String(startTime || "")) || !TIME.test(String(endTime || ""))) return next(invalid("date and times must use YYYY-MM-DD and HH:MM")); return next(); };
const meetingLink = (req, _res, next) => { if (typeof req.body?.meetingLink !== "string" || !req.body.meetingLink.trim()) return next(invalid("meetingLink is required")); return next(); };

module.exports = { requestId, slotIndex, slotBody, meetingLink };
