const jwt = require("jsonwebtoken");

const createAuthenticate = ({ accessSecret }) => (req, res, next) => {
  const [scheme, token] = String(req.get("Authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token provided", code: "INVALID_ACCESS_TOKEN" });
  }
  try {
    const payload = jwt.verify(token, accessSecret);
    if (payload.type !== "access" || !payload.id) throw new Error("Invalid token");
    req.user = { _id: payload.id };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token", code: "INVALID_ACCESS_TOKEN" });
  }
};

module.exports = createAuthenticate;
