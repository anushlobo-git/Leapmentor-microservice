const crypto = require("node:crypto");

const DEFAULT_TTL_SECONDS = 600;

const createCalendarStateService = ({
  secret,
  ttlSeconds = DEFAULT_TTL_SECONDS,
}) => {
  if (!secret) throw new Error("A Google Calendar state secret is required");

  const sign = (encodedPayload) =>
    crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

  const create = (userId) => {
    const payload = Buffer.from(
      JSON.stringify({
        userId,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      }),
    ).toString("base64url");
    return `${payload}.${sign(payload)}`;
  };

  const verify = (state) => {
    const [payload, signature] = String(state || "").split(".");
    const actualSignature = Buffer.from(signature || "");
    const expectedSignature = Buffer.from(payload ? sign(payload) : "");
    if (
      !payload ||
      !signature ||
      actualSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw new Error("Invalid Google Calendar state");
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.userId || !Number.isInteger(data.exp) || data.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Expired Google Calendar state");
    }
    return data;
  };

  return { create, verify };
};

module.exports = createCalendarStateService;
