const fs = require("fs");
const request = require("request");

const udb = require("../node/app.server.user");

const TOKEN_PATH = "server_data/app.server.source.onedrive.credentials.json";
const MICROSOFT_GRAPH_DOMAIN = "https://graph.microsoft.com/v1.0";

var app_secret;
var userTokens = [];

// DELETE APP_SECRET PASS IF NOT NEEDED!!!
// REMEMBER ONEDRIVE API RETURNS A MISSPELLED ACCESS TOKEN IN CREDENTIALS FILE!

exports.init = function() {
  // Load app secret from a local file.
  fs.readFile(
    "server_data/app.server.source.onedrive.app_secret.json",
    (err, content) => {
      if (err) return console.log("Error loading client secret file: ", err);
      app_secret = JSON.parse(content);
    }
  );

  // Load user tokens from a local file.
  fs.readFile(TOKEN_PATH, (err, content) => {
    if (!err) {
      userTokens = JSON.parse(content);
    }
  });
};

function getUserToken(uid) {
  var userToken = null;
  userTokens.forEach(utoken => {
    if (utoken.uid == uid) {
      userToken = utoken;
    }
  });
  return userToken;
}

function setUserToken(uid, token) {
  var userToken = getUserToken(uid);
  var expiry = new Date();
  expiry.setTime(expiry.getTime() + (token.expires_in - 10) * 1000);
  var newToken = { uid: uid, token: token, expires: expiry.getTime() };
  if (userToken == null) {
    userTokens.push(newToken);
  } else {
    var newArray = [];
    userTokens.forEach(utoken => {
      if (utoken.uid != uid) {
        newArray.push(utoken);
      } else if (token != null) {
        newArray.push(newToken);
      }
    });
    userTokens.length = 0;
    newArray.forEach(utoken => userTokens.push(utoken));
  }
  saveUserTokens();
}

function saveUserTokens() {
  fs.writeFile(TOKEN_PATH, JSON.stringify(userTokens), err => {
    if (err) console.error(err);
  });
}

exports.beginAuthorize = function(uid, onPrompt, onSuccess, onFail) {
  var userToken = getUserToken(uid);
  if (userToken) {
    if (new Date().getTime() < userToken.expires) {
      onSuccess();
    } else {
      refreshAccessToken(uid, onSuccess, onFail);
    }
  } else {
    var url =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" +
      "?client_id=" +
      app_secret.client_id +
      "&response_type=code" +
      "&redirect_uri=" +
      encodeURIComponent("http://localhost:8080/connect/onedrive") +
      "&scope=" +
      encodeURIComponent(
        "offline_access user.read files.read files.read.all sites.read.all"
      );
    onPrompt(url);
  }
};

exports.finishAuthorize = function(uid, code, onSuccess, onFail) {
  request.post(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      form: {
        client_id: app_secret.client_id,
        client_secret: app_secret.client_secret,
        code: code,
        grant_type: "authorization_code"
      }
    },
    (error, response, body) => {
      var data = JSON.parse(body);
      if (!error && response.statusCode == 200) {
        setUserToken(uid, data);
        onSuccess();
      } else {
        onFail(parseErrorJSON(response.statusCode, data));
      }
    }
  );
};

function refreshAccessToken(uid, onSuccess, onFail) {
  request.post(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      form: {
        client_id: app_secret.client_id,
        redirect_uri: encodeURIComponent(
          "http://localhost:8080/connect/onedrive"
        ),
        client_secret: app_secret.client_secret,
        refresh_token: getUserToken(uid).token.refresh_token,
        grant_type: "refresh_token"
      }
    },
    (error, response, body) => {
      var data = JSON.parse(body);
      if (!error && response.statusCode == 200) {
        setUserToken(uid, data);
        onSuccess();
      } else {
        onFail(parseErrorJSON(response.statusCode, data));
      }
    }
  );
}

exports.listFiles = function(uid, onSuccess, onFail) {
  var userToken = getUserToken(uid);

  if (new Date().getTime() >= userToken.expires) {
    refreshAccessToken(
      uid,
      () => {
        this.listFiles(uid, onSuccess, onFail);
      },
      onFail
    );
    return;
  }

  request.get(
    MICROSOFT_GRAPH_DOMAIN + "/drive/root/children",
    {
      headers: {
        Authorization: "Bearer " + userToken.token.access_token,
        Accept: "application/json"
      }
    },
    (error, response, body) => {
      var data = JSON.parse(body);
      if (!error && response.statusCode == 200) {
        onSuccess(data);
      } else {
        onFail(parseErrorJSON(response.statusCode, data));
      }
    }
  );
};

function parseErrorJSON(statusCode, data) {
  return {
    errors: [
      {
        code: statusCode,
        desc: data.code ? data.code : data.error,
        message: data.message ? data.message : data.error_description,
        innerError: data.innerError ? data.innerError : data
      }
    ]
  };
}
