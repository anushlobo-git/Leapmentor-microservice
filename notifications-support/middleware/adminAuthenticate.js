const jwt = require("jsonwebtoken");

const parseCookies = (header) => Object.fromEntries(String(header || "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));

const createAdminAuthenticate = ({ accessSecret }) => (req, res, next) => {
  const cookies = parseCookies(req.get("Cookie"));
  const token = cookies.adminToken;
  if (!token) return res.status(401).json({ message: "No admin token provided", code: "INVALID_ADMIN_TOKEN" });
  try {
    const payload = jwt.verify(token, accessSecret);
    if (payload.role !== "admin" || payload.type !== "access") throw new Error("Invalid admin token");
    req.admin = { _id: payload.id, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired admin token", code: "INVALID_ADMIN_TOKEN" });
  }
};

module.exports = createAdminAuthenticate;
