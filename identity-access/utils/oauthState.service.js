const crypto = require("node:crypto");

const createOAuthStateService = ({ secret }) => {
  const signState = (payload) => {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");
    return `${data}.${signature}`;
  };

  const verifyState = (state) => {
    if (!state || typeof state !== "string") {
      throw new Error("Invalid state parameter");
    }

    const [data, signature] = state.split(".");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data || "")
      .digest("hex");
    const signaturesMatch =
      signature &&
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    if (!signaturesMatch) throw new Error("Invalid state parameter");
    return JSON.parse(Buffer.from(data, "base64").toString());
  };

  return { signState, verifyState };
};

module.exports = createOAuthStateService;
