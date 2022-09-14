const crypto = require("crypto");
const axios = require("axios");
const { API_HOST } = require("./constants");

/**
 * Format scope
 * @param {string} scope - Raw scope
 * @returns {string} A formatted version of the scope
 */
exports.formatScope = (scope) =>
  scope
    .split(",")
    .map((el) => "user." + el.trim())
    .join(",");

/**
 * Generate Signature
 * @param {string} action - Action type
 * @param {string} clientId - Withings client ID
 * @param {string} clientSecret - Withings client Secret
 * @param {string} baseValue - The signature influencer
 * @returns {string} - The Generated signature
 */
exports.generateSignature = (action, clientId, clientSecret, baseValue) => {
  const signature = `${action},${clientId},${baseValue}`;
  const hmac = crypto.createHmac("sha256", clientSecret);
  const data = hmac.update(signature);

  return data.digest("hex");
};

/**
 * Generate nonce
 * @param {string} clientId - Withings client ID
 * @param {string} clientSecret - Withings client secret
 * @returns {string} Generated nonce
 */
exports.getNonce = async (clientId, clientSecret) => {
  try {
    const timestamp = Math.floor(+new Date() / 1000);
    const {
      data: {
        body: { nonce },
      },
    } = await axios.post(`${API_HOST}/signature`, {
      action: "getnonce",
      client_id: clientId,
      timestamp,
      signature: this.generateSignature(
        "getnonce",
        clientId,
        clientSecret,
        timestamp
      ),
    });
    return nonce;
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
};
