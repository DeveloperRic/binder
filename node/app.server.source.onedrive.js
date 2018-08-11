const fs = require("fs");
const request = require("request");

const udb = require("../node/app.server.user");

const TOKEN_PATH = "server_data/app.server.source.onedrive.credentials.json";
const MICROSOFT_GRAPH_DOMAIN = "https://graph.microsoft.com/v1.0";

var app_secret;
var userTokens = [];

// If modifying a user's scope, delete their credentials from onedrive.credentials.json.
const SCOPE_LEVELS = [
  "user.read files.read.all",
  "user.read files.readwrite.all"
];

// DELETE APP_SECRET PASS IF NOT NEEDED!!!
// REMEMBER ONEDRIVE API RETURNS A MISSPELLED ACCESS TOKEN IN CREDENTIALS FILE!

exports.init = function() {
  // Load app secret from a local file.
  fs.readFile(
    "server_data/app.server.source.onedrive.app_secret.json",
    (err, content) => {
      if (err) {
        if (err.code == "ENOENT") {
          return console.log("Couldn't find onedrive client secret!");
        } else {
          return console.log("Error loading client secret file: ", err);
        }
      }
      app_secret = JSON.parse(content);
    }
  );

  // Load user tokens from a local file.
  fs.readFile(TOKEN_PATH, (err, content) => {
    if (!err) {
      userTokens = JSON.parse(content);
    } else if (err.code == "ENOENT") {
      saveUserTokens();
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
  if (token != null) {
    expiry.setTime(expiry.getTime() + (token.expires_in - 10) * 1000);
  }
  var newToken = { uid: uid, token: token, expires: expiry.getTime() };
  if (userToken == null && token != null) {
    // if a token doesn't exist and there is a token to add
    userTokens.push(newToken);
  } else if (userToken != null && token == null) {
    // if a token exists and you are trying to remove it
    for (let i in userTokens) {
      if (userTokens[i].uid == uid) {
        userTokens.splice(i, 1);
        break;
      }
    }
  } else if (token != null) {
    // otherwise replace the current token with the new one
    userToken = newToken;
  }
  saveUserTokens();
}

function saveUserTokens() {
  fs.writeFile(TOKEN_PATH, JSON.stringify(userTokens), err => {
    if (err) console.error(err);
  });
}

exports.resetUserToken = function(uid) {
  setUserToken(uid, null);
  return !getUserToken(uid);
};

exports.beginAuthorize = function(
  uid,
  forceUpdate,
  onPrompt,
  onSuccess,
  onFail
) {
  var userToken = getUserToken(uid);
  if (userToken && !forceUpdate) {
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
      encodeURIComponent("https://binder-211420.appspot.com/connect/onedrive") +
      // "&redirect_uri=" +
      // encodeURIComponent("http://localhost:8080/connect/onedrive") +
      "&scope=" +
      encodeURIComponent(
        "offline_access " + SCOPE_LEVELS[udb.getUserWithUID(uid).accessLevel]
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

function unAuthorize(uid, onSuccess, onFail) {
  setUserToken(uid, null);
  if (getUserToken(uid) == null) {
    onSuccess();
  } else {
    onFail({
      errors: [{ code: 500, message: "Couldn't disconnect user's onedrive" }]
    });
  }
}

exports.unAuthorize = unAuthorize;

exports.listFiles = function(uid, folderId, params, onSuccess, onFail) {
  var requestUrl = "/me/drive/items/" + folderId + "/children";
  if (folderId == "root") {
    requestUrl = "/drive/root/children";
  }
  requestUrl += "?select=id,name,folder,webUrl,size&top=28";
  if (params) {
    requestUrl +=
      "&" +
      Object.keys(params)
        .map(function(key) {
          return key.toLowerCase() + "=" + encodeURIComponent(params[key]);
        })
        .join("&");
  }
  sendRequest(uid, requestUrl, onSuccess, onFail);
};

exports.getFileMetadata = function(uid, fileId, keys, onSuccess, onFail) {
  var fields = "id";
  if (keys.length > 0) {
    keys.forEach(key => {
      fields += "," + key;
    });
  }
  sendRequest(
    uid,
    "/me/drive/items/" + fileId + "?select=" + fields,
    onSuccess,
    onFail
  );
};

exports.getFileCollection = function(
  uid,
  fileId,
  collection,
  onSuccess,
  onFail
) {
  sendRequest(
    uid,
    "/me/drive/items/" + fileId + "/" + collection,
    onSuccess,
    onFail
  );
};

exports.getFileContent = function(uid, fileId, onSuccess, onFail) {
  sendRequest(uid, "/me/drive/items/" + fileId + "/content", onSuccess, onFail);
};

function sendRequest(uid, requestUrl, onSuccess, onFail, refreshed) {
  var userToken = getUserToken(uid);
  // check user token is still valid
  if (new Date().getTime() >= userToken.expires) {
    if (!refreshed) {
      refreshAccessToken(
        uid,
        () => {
          sendRequest(uid, requestUrl, onSuccess, onFail, true);
        },
        onFail
      );
    } else {
      unAuthorize(
        uid,
        () => {
          var user = udb.getUserWithUID(uid);
          if (user && user.connectedSources.includes("onedrive")) {
            user.connectedSources.splice(
              user.connectedSources.indexOf("onedrive"),
              1
            );
            udb.saveUsers();
          }
          onFail({
            errors: [
              {
                code: 500,
                message: "The user's onedrive access token is broken :("
              }
            ]
          });
        },
        () => {
          onFail({
            errors: [
              {
                code: 500,
                message:
                  "Storage of onedrive tokens is broken :( Please report this!"
              }
            ]
          });
        }
      );
    }
    return;
  }
  // send the request via GET protocol
  request.get(
    MICROSOFT_GRAPH_DOMAIN + requestUrl,
    {
      headers: {
        Authorization: "Bearer " + userToken.token.access_token,
        Accept: "application/json"
      }
    },
    (error, response, body) => {
      var data = body;
      try {
        try {
          data = JSON.parse(body);
        } catch (err1) {}
        if (!error && response.statusCode == 200) {
          onSuccess(data);
        } else {
          onFail(parseErrorJSON(response.statusCode, data));
        }
      } catch (err) {
        onFail({
          errors: [{ code: 500, message: JSON.stringify(err) }]
        });
      }
    }
  );
}

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
