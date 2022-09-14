const axios = require("axios");

const { formatScope, generateSignature, getNonce } = require("./utils");
const { GET_AUTHORIZATION_CODE_URL, API_HOST } = require("./constants");

/**
 * Create an instance of WithingsNodeOauth2
 * @class
 */
class WithingsNodeOauth2 {
  #clientId;
  #clientSecret;
  #callbackURL;

  /**
   * @constructor
   * @param {object} param0 - Client options
   */
  constructor({ clientId, clientSecret, callbackURL }) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#callbackURL = callbackURL;
  }

  get clientId() {
    return this.#clientId;
  }

  set clientId(clientId) {
    this.#clientId = clientId;
  }

  get clientSecret() {
    return this.#clientSecret;
  }

  set clientSecret(clientSecret) {
    this.#clientSecret = clientSecret;
  }

  get callbackURL() {
    return this.#callbackURL;
  }

  set callbackURL(callbackURL) {
    this.#callbackURL = callbackURL;
  }

  /**
   * Generate Auth URL
   * @param {string} state - URL state
   * @param {string} scope - Requested scope
   * @returns {string} Authorization URL
   */
  getAuthorizeURL(state, scope) {
    const formattedScope = formatScope(scope) || null;

    const authURL = `${GET_AUTHORIZATION_CODE_URL}?response_type=code&client_id=${
      this.#clientId
    }&state=${state || null}&scope=${formattedScope}&redirect_uri=${
      this.#callbackURL
    }`;

    return authURL;
  }

}

module.exports = WithingsNodeOauth2;
