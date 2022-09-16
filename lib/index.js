const axios = require("axios");

const {
  formatScope,
  generateSignature,
  getNonce,
  normalizeDay,
  normalizeMonth,
} = require("./utils");
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

  /**
   * Generate tokens
   * @param {string} code - Access code
   * @returns {Promise<Object>} - {user id, access and refresh tokens, expiration date, token type, and scope}
   */
  getAccessToken(code) {
    return new Promise(async (resolve, reject) => {
      try {
        const nonce = await getNonce(this.#clientId, this.#clientSecret);

        const { data } = await axios.post(`${API_HOST}/oauth2`, {
          action: "requesttoken",
          client_id: this.#clientId,
          nonce,
          signature: generateSignature(
            "requesttoken",
            this.#clientId,
            this.#clientSecret,
            nonce
          ),
          client_secret: this.#clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.#callbackURL,
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Refresh the access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>}
   */
  refreshAccessToken(refreshToken) {
    return new Promise(async (resolve, reject) => {
      try {
        const nonce = await getNonce(this.#clientId, this.#clientSecret);

        const { data } = await axios.post(`${API_HOST}/oauth2`, {
          action: "requesttoken",
          client_id: this.#clientId,
          nonce,
          signature: generateSignature(
            "requesttoken",
            this.#clientId,
            this.#clientSecret,
            nonce
          ),
          client_secret: this.#clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user devices
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
  getUserDevices(accessToken) {
    return new Promise(async (resolve, reject) => {
      try {
        const { data } = await axios.post(
          `${API_HOST}/user`,
          {
            action: "getdevice",
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user goals
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
  getUserGoals(accessToken) {
    return new Promise(async (resolve, reject) => {
      try {
        const { data } = await axios.post(
          `${API_HOST}/user`,
          {
            action: "getgoals",
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user measures
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
  getUserMeasures(
    accessToken,
    options = {
      meastypes: "1,4,12",
      category: 1,
      startdate: Date.now() - 86400000,
      enddate: Date.now(),
      lastupdate: Date.now(),
    }
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const { data } = await axios.post(
          `${API_HOST}/measure`,
          {
            action: "getmeas",
            ...options,
          },
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user activities
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
   getUserActivities(
    accessToken,
    options = {
      startdateymd: `${new Date(Date.now() - (86400000 * 30)).getFullYear()}-${normalizeMonth(new Date(Date.now() - (86400000 * 30)).getMonth())}-${normalizeDay(new Date(Date.now() - (86400000 * 30)).getDate())}`,
      enddateymd: `${new Date().getFullYear()}-${normalizeMonth(new Date().getMonth())}-${normalizeDay(new Date().getDate())}`,
    }
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const { data } = await axios.post(
          `${API_HOST}/measure`,
          {
            action: "getactivity",
            ...options,
          },
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = WithingsNodeOauth2;
