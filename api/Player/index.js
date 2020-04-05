var request = require('requestretry');

const spotifyTokenApiUrl = "https://accounts.spotify.com/api/token";
const msftLoginBase = "https://login.microsoftonline.com/";
const spotifyNowPlayingUrl = "https://api.spotify.com/v1/me/player/currently-playing";

var spotifyAccessToken = null;

async function getServicePrincipalAccessToken(){
  return new Promise(function(resolve, reject) {
    request({
      url: msftLoginBase + process.env["AadTenantId"] + '/oauth2/v2.0/token',
      form: {
          grant_type: "client_credentials",
          scope: "https://vault.azure.net/.default",
          client_id: process.env["AadClientId"],
          client_secret: process.env["AadClientSecret"]
      },
      method: 'GET'
    }, function(err, res, body){
      // this callback will only be called when the request succeeded or after maxAttempts or on error
      if (!err && res.statusCode == 200) {
        resolve(JSON.parse(body));
      } else {
        reject(err);
      }
    });
  });
}

function getKeyVaultSecretUrl(){
  return "https://" + process.env["KeyVaultName"] + '.vault.azure.net/secrets/SpotifyAccessToken?api-version=2016-10-01'
}

async function getSpotifyAccessKeyFromKeyVault(){
  return new Promise(async function(resolve, reject) {
    var servicePrincipalResult = await getServicePrincipalAccessToken();

    request({
      url: getKeyVaultSecretUrl(),
      headers: {'Authorization': 'Bearer ' + servicePrincipalResult.access_token},
      method: 'GET'
    }, function(err, res, body){
      // this callback will only be called when the request succeeded or after maxAttempts or on error
      if (!err && res.statusCode == 200) {
        resolve(JSON.parse(body).value);
      } else {
        reject(err);
      }
    });
  });
}

async function setSpotifyAccessKeyInKeyVault(value){
  return new Promise(async function(resolve, reject) {
    var servicePrincipalResult = await getServicePrincipalAccessToken();

    request({
      url: getKeyVaultSecretUrl(),
      headers: {
        'Authorization': 'Bearer ' + servicePrincipalResult.access_token,
        'Content-Type': 'application/json'
      },
      method: 'PUT',
      body: JSON.stringify({"value": value})
    }, function(err, res, body){
      // this callback will only be called when the request succeeded or after maxAttempts or on error
      if (!err && res.statusCode == 200) {
        resolve(JSON.parse(body).value);
      } else {
        reject(err);
      }
    });
  });
}

async function getSpotifyAuthToken(){
  return new Promise(function(resolve, reject) {
    request({
      url: spotifyTokenApiUrl,
      headers: {'Authorization': 'Basic ' + process.env["SpotifyTokenHeader"]},
      form: {
          grant_type: "refresh_token",
          refresh_token: process.env["SpotifyRefreshToken"]
      },
      method: 'POST'
    }, function(err, res, body){
      // this callback will only be called when the request succeeded or after maxAttempts or on error
      if (!err && res.statusCode == 200) {
        var token = JSON.parse(body).access_token;
        resolve(token);
      } else {
        reject(err);
      }
    });
  });
}

async function newApiTokenRetryStrategy(err, response, body, options){
  var mustRetry = false;
  if (response.statusCode == 401)
  {
    var token = await getSpotifyAuthToken();
    await setSpotifyAccessKeyInKeyVault(token);
    spotifyAccessToken = token;
    options.headers = {'Authorization': `Bearer ${token}`}
    mustRetry = true;
  }

  return {
    mustRetry: mustRetry,
    options: options
  }
}

function convertSpotifyResponse(responseJson)
{
  var artistNames = [];
  for (var i = 0; i < responseJson.item.artists.length; i++){
    artistNames.push(responseJson.item.artists[i].name);
  }

  return {
    is_playing: true,
    name: responseJson.item.name,
    album: {
      name: responseJson.item.album.name,
      images: responseJson.item.album.images
    },
    artists: artistNames,
    progress_ms: responseJson.progress_ms,
    duration_ms: responseJson.item.duration_ms,
    external_uri: responseJson.item.external_urls.spotify
  }
}

async function getSpotifyNowPlaying(){
  return new Promise(function(resolve, reject) {
    request({
      url: spotifyNowPlayingUrl,
      headers: {'Authorization': 'Bearer ' + spotifyAccessToken},
      method: 'GET',
      retryStrategy: newApiTokenRetryStrategy
    }, function(err, res, body){
      if (!err) {
        if (res.statusCode == 204)
        {
          resolve(null);
          return;
        }

        var responseJson = JSON.parse(res.body);
        resolve(convertSpotifyResponse(responseJson));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = async function (context, req) {
  if (req.method === "GET")
  {
      if (spotifyAccessToken === null)
      {
        spotifyAccessToken = await getSpotifyAccessKeyFromKeyVault();
      }

      var result = await getSpotifyNowPlaying();
      if (result === null)
      {
        context.res = { status : 200, body: {is_playing: false}};
        context.res.headers = { 'Content-Type':'application/json' };
        return;
      }

      context.res = { status : 200, body: result };
      context.res.headers = { 'Content-Type':'application/json' };
      return;
  }

  // Otherwise
  context.res = { status : 404 };
};
