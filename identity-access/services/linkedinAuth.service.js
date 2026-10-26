const AppError = require("../utils/AppError");

const TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";

const createLinkedinAuthService = ({
  federatedAuthService,
  clientId,
  clientSecret,
  callbackUrl,
  fetchImpl = globalThis.fetch,
}) => {
  const exchangeLinkedinCode = async (payload, options) => {
    if (!payload?.code) {
      throw new AppError(
        "Missing LinkedIn authorization code",
        400,
        "LINKEDIN_CODE_REQUIRED",
      );
    }
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new AppError(
        "LinkedIn authentication is not configured",
        503,
        "LINKEDIN_NOT_CONFIGURED",
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new AppError(
        "LinkedIn authentication transport is unavailable",
        503,
        "LINKEDIN_TRANSPORT_UNAVAILABLE",
      );
    }

    let tokenResponse;
    try {
      tokenResponse = await fetchImpl(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: payload.code,
          redirect_uri: callbackUrl,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    } catch (error) {
      throw new AppError(
        `LinkedIn OAuth code exchange failure: ${error.message}`,
        401,
        "LINKEDIN_TOKEN_EXCHANGE_FAILED",
      );
    }

    const tokenBody = await readJson(tokenResponse);
    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new AppError(
        `LinkedIn OAuth code exchange failure: ${
          tokenBody.error_description || "Unable to obtain access token"
        }`,
        401,
        "LINKEDIN_TOKEN_EXCHANGE_FAILED",
      );
    }

    let profileResponse;
    try {
      profileResponse = await fetchImpl(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
      });
    } catch (error) {
      throw new AppError(
        `Failed to fetch profile info from LinkedIn OpenID endpoints: ${error.message}`,
        401,
        "LINKEDIN_PROFILE_FETCH_FAILED",
      );
    }

    const profile = await readJson(profileResponse);
    const name =
      profile.name ||
      `${profile.given_name || ""} ${profile.family_name || ""}`.trim() ||
      "User";

    if (!profileResponse.ok || !profile.sub || !profile.email) {
      throw new AppError(
        "LinkedIn authentication failed: structural OpenID profile attributes missing",
        400,
        "LINKEDIN_PROFILE_INVALID",
      );
    }

    return federatedAuthService.authenticateFederatedUser(
      {
        provider: "linkedin",
        providerId: profile.sub,
        email: profile.email,
        name,
        roles: payload.roles,
        termsAccepted: payload.termsAccepted,
        emailVerified: true,
      },
      options,
    );
  };

  return { exchangeLinkedinCode };
};

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

module.exports = createLinkedinAuthService;
