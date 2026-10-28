const crypto = require("node:crypto");

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest();

const normalizeRoute = (value) => {
  const route = String(value || "").trim();
  if (!route) return "";
  return route.replace(/\/+$/, "").toLowerCase();
};

const toAcceptedDigests = (tokens) =>
  tokens
    .filter((token) => typeof token === "string" && token.length > 0)
    .map((token) => digest(`Bearer ${token}`));

const createInternalServiceAuth =
  ({ serviceToken, serviceTokens = [], routeScopes = {} } = {}) =>
  (req, res, next) => {
    const defaultAcceptedDigests = toAcceptedDigests([
      serviceToken,
      ...serviceTokens,
    ]);

    const requestPath = normalizeRoute(
      req?.originalUrl || req?.url || req?.baseUrl || "",
    );

    const acceptedDigests = Object.entries(routeScopes).reduce(
      (result, [route, tokens]) => {
        const normalizedRoute = normalizeRoute(route);
        if (
          normalizedRoute &&
          (requestPath === normalizedRoute ||
            requestPath.startsWith(`${normalizedRoute}/`))
        ) {
          return toAcceptedDigests(Array.isArray(tokens) ? tokens : [tokens]);
        }
        return result;
      },
      defaultAcceptedDigests,
    );

    if (acceptedDigests.length === 0) {
      return res.status(503).json({
        error: "Internal service authentication is not configured",
        code: "INTERNAL_AUTH_NOT_CONFIGURED",
      });
    }

    const presented = digest(req.get("Authorization") || "");
    const matched = acceptedDigests.some((expected) =>
      crypto.timingSafeEqual(presented, expected),
    );

    if (!matched) {
      return res.status(401).json({
        error: "Invalid internal service credentials",
        code: "INVALID_INTERNAL_AUTH",
      });
    }

    return next();
  };

module.exports = createInternalServiceAuth;
