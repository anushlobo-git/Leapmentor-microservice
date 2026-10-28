const crypto = require("node:crypto");

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest();

/**
 * Authenticates service-to-service calls with a static bearer token.
 *
 * `serviceToken` keeps the original single-token form. `serviceTokens` lets one
 * route accept more than one caller, each with its own token, so a token can be
 * rotated or revoked per caller without touching the others.
 *
 * Presented and expected values are hashed first so the comparison is
 * constant-time even when their lengths differ.
 */
const createInternalServiceAuth = ({
  serviceToken,
  serviceTokens = [],
} = {}) => {
  const acceptedDigests = [serviceToken, ...serviceTokens]
    .filter((token) => typeof token === "string" && token.length > 0)
    .map((token) => digest(`Bearer ${token}`));

  const isAccepted = (authorizationHeader) => {
    const presented = digest(authorizationHeader || "");
    let matched = false;
    for (const expected of acceptedDigests) {
      if (crypto.timingSafeEqual(presented, expected)) matched = true;
    }
    return matched;
  };

  return (req, res, next) => {
    if (acceptedDigests.length === 0) {
      return res.status(503).json({
        error: "Internal service authentication is not configured",
        code: "INTERNAL_AUTH_NOT_CONFIGURED",
      });
    }

    if (!isAccepted(req.get("Authorization"))) {
      return res.status(401).json({
        error: "Invalid internal service credentials",
        code: "INVALID_INTERNAL_AUTH",
      });
    }

    return next();
  };
};

module.exports = createInternalServiceAuth;
