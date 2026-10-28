const crypto = require("node:crypto");

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest();

const normalizeRoute = (value) => {
  const route = String(value || "")
    .split("?", 1)[0]
    .trim();
  if (!route) return "";
  return route.replace(/\/+$/, "").toLowerCase();
};

const asTokenList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
};

const toAcceptedDigests = (tokens) =>
  tokens
    .filter((token) => typeof token === "string" && token.length > 0)
    .map((token) => digest(`Bearer ${token}`));

/**
 * Authenticates service-to-service calls with a static bearer token.
 *
 * `serviceToken` keeps the original single-token form. `serviceTokens` lets one
 * route accept more than one caller, each with its own token, so a token can be
 * rotated or revoked per caller without touching the others.
 *
 * `routeScopes` allows a route family to be narrowed to specific callers. This
 * keeps a token from being valid for the whole internal route family when only a
 * subset of callers should be trusted there.
 *
 * Presented and expected values are hashed first so the comparison is
 * constant-time even when their lengths differ.
 */
const createInternalServiceAuth = ({
  serviceToken,
  serviceTokens = [],
  routeScopes = {},
} = {}) => {
  const defaultAcceptedDigests = toAcceptedDigests([
    serviceToken,
    ...asTokenList(serviceTokens),
  ]);

  const routeScopeDigests = Object.entries(routeScopes).map(
    ([route, tokens]) => ({
      route: normalizeRoute(route),
      acceptedDigests: toAcceptedDigests(asTokenList(tokens)),
    }),
  );

  const resolveAcceptedDigests = (req) => {
    const requestPath = normalizeRoute(
      req?.originalUrl || req?.url || req?.baseUrl || "",
    );

    for (const { route, acceptedDigests } of routeScopeDigests) {
      if (!route) continue;
      if (requestPath === route || requestPath.startsWith(`${route}/`)) {
        return acceptedDigests;
      }
    }

    return defaultAcceptedDigests;
  };

  const isAccepted = (authorizationHeader, request) => {
    const presented = digest(authorizationHeader || "");
    const acceptedDigests = resolveAcceptedDigests(request);
    let matched = false;
    for (const expected of acceptedDigests) {
      if (crypto.timingSafeEqual(presented, expected)) matched = true;
    }
    return matched;
  };

  return (req, res, next) => {
    const acceptedDigests = resolveAcceptedDigests(req);

    if (acceptedDigests.length === 0) {
      return res.status(503).json({
        error: "Internal service authentication is not configured",
        code: "INTERNAL_AUTH_NOT_CONFIGURED",
      });
    }

    if (!isAccepted(req.get("Authorization"), req)) {
      return res.status(401).json({
        error: "Invalid internal service credentials",
        code: "INVALID_INTERNAL_AUTH",
      });
    }

    return next();
  };
};

module.exports = createInternalServiceAuth;
