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


