const jwt = require("jsonwebtoken");

const createSocketAuth = ({ accessSecret }) => (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error: no token provided"));

  try {
    const payload = jwt.verify(token, accessSecret);
    if (payload.type !== "access" || !payload.id) throw new Error("Invalid token");
    socket.user = { _id: payload.id };
    return next();
  } catch {
    return next(new Error("Authentication error: invalid or expired token"));
  }
};

module.exports = createSocketAuth;
