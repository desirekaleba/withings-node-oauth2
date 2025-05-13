const {
  formatScope,
  generateSignature,
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
  async getAccessToken(code) {
    const response = await fetch(`${API_HOST}/oauth2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "requesttoken",
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.#callbackURL,
        }),
      }
    );
    return await response.json();
  }

  /**
   * Refresh the access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>}
   */
  async refreshAccessToken(refreshToken) {
    const response = await fetch(`${API_HOST}/oauth2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "requesttoken",
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          grant_type: "refresh_token",
          code,
          redirect_uri: this.#callbackURL,
        }),
      }
    );
    return await response.json();
  }

  /**
   * Get user devices
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
  async getUserDevices(accessToken) {
    const response = await fetch(`${API_HOST}/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getdevice",
      }),
    });
    return await response.json();
  }

  /**
   * Get user goals
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>}
   */
  async getUserGoals(accessToken) {
    const response = await fetch(`${API_HOST}/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getgoals",
      }),
    });
    return await response.json();
  }

  /**
   * Get user measures
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getUserMeasures(
    accessToken,
    options = {
      meastypes: "1,4,12",
      category: 1,
      startdate: Date.now() - 86400000,
      enddate: Date.now(),
      lastupdate: Date.now(),
    }
  ) {
    const response = await fetch(`${API_HOST}/measure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getmeas",
        ...options,
      }),
    });
    return await response.json();
  }

  /**
   * Get user activities
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getUserActivities(
    accessToken,
    options = {
      startdateymd: `${new Date(
        Date.now() - 86400000 * 30
      ).getFullYear()}-${normalizeMonth(
        new Date(Date.now() - 86400000 * 30).getMonth()
      )}-${normalizeDay(new Date(Date.now() - 86400000 * 30).getDate())}`,
      enddateymd: `${new Date().getFullYear()}-${normalizeMonth(
        new Date().getMonth()
      )}-${normalizeDay(new Date().getDate())}`,
    }
  ) {
    const response = await fetch(`${API_HOST}/measure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getactivity",
        ...options,
      }),
    });
    return await response.json();
  }

  /**
   * Get user daily activities
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getUserDailyActivities(accessToken, options = {}) {
    const response = await fetch(`${API_HOST}/measure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getintradayactivity",
        ...options,
      }),
    });
    return await response.json();
  }

  /**
   * Get user workouts
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getUserWorkouts(
    accessToken,
    options = {
      startdateymd: `${new Date(
        Date.now() - 86400000 * 30
      ).getFullYear()}-${normalizeMonth(
        new Date(Date.now() - 86400000 * 30).getMonth()
      )}-${normalizeDay(new Date(Date.now() - 86400000 * 30).getDate())}`,
      enddateymd: `${new Date().getFullYear()}-${normalizeMonth(
        new Date().getMonth()
      )}-${normalizeDay(new Date().getDate())}`,
    }
  ) {
    const response = await fetch(`${API_HOST}/measure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getworkouts",
        ...options,
      }),
    });
    return await response.json();
  }

  /**
   * Get heart summary
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getHeartSummary(accessToken, options = {}) {
    const response = await fetch(`${API_HOST}/heart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "list",
        ...options,
      }),
    });
    return await response.json();
  }

  /**
   * Get sleep summary
   * @param {string} accessToken - User's access token
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getSleepSummary(
    accessToken,
    options = {
      startdateymd: `${new Date(
        Date.now() - 86400000 * 30
      ).getFullYear()}-${normalizeMonth(
        new Date(Date.now() - 86400000 * 30).getMonth()
      )}-${normalizeDay(new Date(Date.now() - 86400000 * 30).getDate())}`,
      enddateymd: `${new Date().getFullYear()}-${normalizeMonth(
        new Date().getMonth()
      )}-${normalizeDay(new Date().getDate())}`,
      lastupdate: Date.now(),
    }
  ) {
    const response = await fetch(`${API_HOST}/sleep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "getsummar",
        ...options,
      }),
    });
    return await response.json();
  }
}

module.exports = WithingsNodeOauth2;
