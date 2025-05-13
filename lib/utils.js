const crypto = require("crypto");
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
 * Normalize month
 * @param {integer} month
 * @returns {string}
 */
exports.normalizeMonth = (month) =>
  month < 10 ? "0" + (month + 1) : "" + (month + 1);

/**
 * Normalize day
 * @param {integer} day
 * @returns {string}
 */
exports.normalizeDay = (day) => (day < 10 ? "0" + day : "" + day);
