# withings-node-oauth2

> An OAuth2 API client library for Withings

## Getting started

Install the library from npm
```sh
npm install withings-node-oauth2
```

## API

### Constructor

```js
new WithingsNodeOauth2({
    clientId: "YOUR-WITHINGS-CLIENT-ID",
    clientSecret: "YOUR-WITHINGS-CLIENT-SECRET",
    callbackURL: "YOUR-WITHINGS-CALLBACK-URL"
});
```

Make sure you replace the above values(clientId, clientSecret, and callbackURL) with your withings application details. If you don't have a withings developer account yet, go read [Create your developer account](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/developer-account/create-your-accesses-no-medical-cloud) and follow the instruction.

### Methods
#### getAuthorizeURL

```js
getAuthorizeURL(state: string, scope: string): string
```
This method takes two strings (`state`, and `scope`). `state` is a value you define. It will be bound to the returned auth URL as a url query which can be used to make sure that the the redirect back to your site or app was not spoofed. `scope` Is a comma-separated list of permission scopes you want to ask your user for. Click [here](https://developer.withings.com/developer-guide/v3/data-api/all-available-health-data) to see the Index Data API section from withings to know which scope you should use.

#### getAccessToken

```js
getAccessToken(code: string): Promise<Object>
```
`getAuthorizeURL will redirect to your callback URL with a code query attached to it. That is your authorization code which can be used to request an access token.

This method will require the authorization code and will return the following payload

```json
{
    "status": 0,
    "body": {
        "userid": "user-id",
        "access_token": "access-token",
        "refresh_token": "refresh-token",
        "scope": "requested scopes",
        "expires_in": 10800,
        "token_type": "Bearer"
    }
}
```
You will mostly need the access_token to make further requests to withings server.

PS: Withings uses the status 0 to mean a successful response.

#### refreshAccessToken

```js
refreshAccessToken(refreshToken: string): Promise<Object>
```
If user's access token has expired, this is the method you will need to get a new access_token and be able to make requests again.
PS: This also returns a new refresh token so you will need to overwrite the current one.

It will return the following payload

```json
{
    "status": 0,
    "body": {
        "userid": "user-id",
        "access_token": "new access-token",
        "refresh_token": "new refresh-token",
        "scope": "requested scopes",
        "expires_in": 10800,
        "token_type": "Bearer"
    }
}
```

#### getUserDevices

```js
getUserDevices(accessToken: string): Promise<Object>
```
Returns the list of user linked devices.

Example response

```json
{
  "status": 0,
  "body": {
    "devices": [
      {
        "type": "Scale",
        "model": "Body Cardio",
        "model_id": 6,
        "battery": "medium",
        "deviceid": "892359876fd8805ac45bab078c4828692f0276b1",
        "hash_deviceid": "892359876fd8805ac45bab078c4828692f0276b1",
        "timezone": "Europe/Paris",
        "last_session_date": 1594159644
      }
    ]
  }
}
```

#### getUserGoals

```js
getUserGoals(accessToken: string): Promise<Object>
```

Returns the goals of a user

Example response

```json
{
  "status": 0,
  "body": {
    "goals": {
      "steps": 10000,
      "sleep": 28800,
      "weight": {
        "value": 70500,
        "unit": -3
      }
    }
  }
}
```
#### getUserMeasures

```js
getUserMeasures(accessToken: string, options?: Object): Promise<Object>
```

Returns measures at a specific date collected by a user. `options` specifies additional data to be included in the response. Click [here](https://developer.withings.com/api-reference/#operation/measure-getmeas) to see the list of available options.

#### getUserActivities

```js
getUserActivities(accessToken: string, options?: Object): Promise<Object>
```

Provides user activity data of a user. To see the list of available options, click [here](https://developer.withings.com/api-reference/#operation/measurev2-getactivity).

#### getUserDailyActivities

```js
getUserDailyActivities(accessToken: string, options?: Object): Promise<Object>
```

Returns user daily activity data. [Here](https://developer.withings.com/api-reference/#operation/measurev2-getintradayactivity) is a list of all possible options.

#### getUserWorkouts

```js
getUserWorkouts(accessToken: string, options?: Object): Promise<Object>
```

Returns workout summaries. See [possible options](https://developer.withings.com/api-reference/#operation/measurev2-getworkouts).

#### getHeartSummary

```js
getHeartSummary(accessToken: string, options?: Object): Promise<Object>
```

Returns a list of ECG records and Afib classification for a given period of time. All options can be found [here](https://developer.withings.com/api-reference/#operation/heartv2-list).

#### getSleepSummary
```js
getSleepSummary(accessToken: string, options?: Object): Promise<Object>
```

Returns sleep activity summaries. [Here](https://developer.withings.com/api-reference/#operation/sleepv2-getsummary) is the list of available options.

## Examples
### Vanilla NodeJS
```js
const http = require('http');
const url = require('url');
const WithingsNodeOauth2 = require('withings-node-oauth2');

const client = new WithingsNodeOauth2({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
});

const PORT = process.env.PORT || 5000;

const server = http.createServer((req, res) => {
    if (req.url === '/authorize' && req.method === 'GET') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write((client.getAuthorizeURL("", "info, activity, metrics"));
        res.end();
    } else if (req.url.startsWith('/callback') && req.method === 'GET') {
        const { code } = url.parse(req.url, true).query;
        client.getAccessToken(code)
        .then((result) => {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(JSON.stringify(result));
            res.end();
        }).catch((error) => {
            console.error(error);
            res.end();
        });
    } else if (req.url === '/sleep' && req.method === 'GET') {
        client.getSleepSummary('access-token')
            .then((result) => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.write(JSON.stringify(result));
                res.end();
            }).catch((error) => {
                console.error(error);
                res.end();
            });
    } else {
        res.end('Route not found');
    }
});

server.listen(PORT);

```

### ExpressJS

```js

```
