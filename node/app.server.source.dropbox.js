const fs = require("fs");
const request = require("request");

const mongodb = require("./app.server.mongodb.js");
const udb = require("../node/app.server.user");

const TOKENS_COL_NAME = "source.dropbox.credentials";
const DROPBOX_API_DOMAIN = "https://api.dropboxapi.com/2";

var app_secret;
var selectedRedirectURI;

// TODO: enable cross-site request forgery protection
// see: https://www.dropbox.com/developers/documentation/http/documentation#oauth2-authorize

// TODO: implement scopes for access tokens
// If modifying a user's scope, delete their credentials from database.
// const SCOPE_LEVELS = [
//   ["https://www.googleapis.com/auth/drive.metadata.readonly"],
//   ["https://www.googleapis.com/auth/drive"]
// ];

exports.init = function() {
  // Load app secret from a local file.
  fs.readFile(
    "server_data/app.server.source.dropbox.app_secret.json",
    (err, content) => {
      if (err) {
        if (err.code == "ENOENT") {
          return console.log("Couldn't find dropbox app secret!");
        } else {
          return console.log("Error loading dropbox app secret file: ", err);
        }
      }
      app_secret = JSON.parse(content);
      selectedRedirectURI = app_secret.redirect_uris[0];
    }
  );
};

function getUserToken(uid, onSuccess, onFail) {
  mongodb.findDocuments(
    TOKENS_COL_NAME,
    { uid: uid },
    docs => {
      if (docs.length == 0) {
        // not a mongodb error / token was not found
        onSuccess(null);
      } else {
        onSuccess(docs[0].token);
      }
    },
    () => {
      // a mongodb error occured
      onFail();
    }
  );
}

function setUserToken(uid, token, onSuccess, onFail) {
  if (token != null) {
    mongodb.upsertDocument(
      TOKENS_COL_NAME,
      { uid: uid },
      { token: token },
      onSuccess,
      onFail
    );
  } else {
    mongodb.removeDocument(TOKENS_COL_NAME, { uid: uid }, onSuccess, onFail);
  }
}

exports.resetUserToken = function(uid, onSuccess, onFail) {
  setUserToken(uid, null, onSuccess, onFail);
};

exports.beginAuthorize = function(
  uid,
  forceUpdate,
  onPrompt,
  onSuccess,
  onFail
) {
  getUserToken(
    uid,
    token => {
      if (token && !forceUpdate) {
        onSuccess();
      } else {
        onPrompt(
          "https://www.dropbox.com/oauth2/authorize" +
            "?client_id=" +
            app_secret.client_id +
            "&response_type=code" +
            "&redirect_uri=" +
            encodeURIComponent(selectedRedirectURI)
        );
      }
    },
    () => {
      failParser(
        500,
        "Dropbox token database is broken :( Please report this!",
        onFail
      );
    }
  );
};

exports.finishAuthorize = function(uid, code, onSuccess, onFail) {
  sendAuthorizationRequest(
    uid,
    {
      grant_type: "authorization_code",
      code: code
    },
    onSuccess,
    onFail
  );
};

function sendAuthorizationRequest(uid, authOptions, onSuccess, onFail) {
  var options = {
    client_id: app_secret.client_id,
    client_secret: app_secret.client_secret,
    grant_type: authOptions.grant_type,
    redirect_uri: selectedRedirectURI
  };
  if (authOptions.code) {
    options = Object.assign(options, { code: authOptions.code });
  }
  if (authOptions.refresh_token) {
    options = Object.assign(options, {
      refresh_token: authOptions.refresh_token
    });
  }
  request.post(
    "https://api.dropboxapi.com/oauth2/token",
    {
      form: options
    },
    (error, response, body) => {
      var data = body;
      try {
        data = JSON.parse(body);
      } catch (err1) {}
      if (!error && response.statusCode == 200) {
        setUserToken(uid, data, onSuccess, () => {
          failParser(
            500,
            "Couldn't update user's dropbox access token",
            onFail
          );
        });
      } else {
        failParser(400, error ? error : data, onFail);
      }
    }
  );
}

exports.unAuthorize = function(uid, onSuccess, onFail) {
  setUserToken(uid, null, onSuccess, () => {
    failParser(500, "Couldn't disconnect user's dropbox", onFail);
  });
};

exports.listFiles = function(uid, folderPath, onSuccess, onFail) {
  sendRequest(
    uid,
    DROPBOX_API_DOMAIN + "/files/list_folder",
    {
      path: folderPath == "root" ? "" : folderPath,
      limit: 25
    },
    onSuccess,
    onFail
  );
};

exports.getFileThumbnails = function(uid, filePaths, onSuccess, onFail) {
  var entries = [];
  filePaths.forEach(filePath => {
    entries.push({
      path: filePath,
      format: "jpeg",
      size: "w64h64",
      mode: "strict"
    });
  });
  sendRequest(
    uid,
    "https://content.dropboxapi.com/2/files/get_thumbnail_batch",
    {
      entries: entries
    },
    onSuccess,
    onFail
  );
};

exports.getFilePreview = function(uid, filePath, onSuccess, onFail) {
  sendRequest(
    uid,
    "https://content.dropboxapi.com/2/files/get_preview",
    null,
    onSuccess,
    onFail,
    {
      "Dropbox-API-Arg": JSON.stringify({ path: filePath })
    }
  );
};

exports.getContentLink = function(uid, filePath, onSuccess, onFail) {
  sendRequest(
    uid,
    DROPBOX_API_DOMAIN + "/files/get_temporary_link",
    {
      path: filePath
    },
    onSuccess,
    onFail
  );
};

exports.search = function(uid, query, onSuccess, onFail) {
  sendRequest(
    uid,
    DROPBOX_API_DOMAIN + "/files/search",
    {
      path: "",
      query: query,
      start: 0,
      max_results: 25,
      mode: "filename"
    },
    onSuccess,
    onFail
  );
};

function sendRequest(uid, requestUrl, requestBody, onSuccess, onFail, headers) {
  getUserToken(
    uid,
    userToken => {
      // check user token is still valid
      if (userToken == null) {
        return failParser(
          403,
          "The user doesn't have a dropbox access token!",
          onFail
        );
      }
      // send the request via GET protocol
      var requestOptions = {
        headers: {
          Authorization: "Bearer " + userToken.access_token,
          Accept: "application/json"
        },
        json: true
      };
      if (headers) {
        requestOptions.headers = Object.assign(requestOptions.headers, headers);
      }
      if (requestBody) {
        requestOptions = Object.assign(requestOptions, {
          body: requestBody
        });
      }
      request.post(requestUrl, requestOptions, (error, response, body) => {
        var data = body;
        try {
          try {
            data = JSON.parse(body);
          } catch (err1) {}
          if (!error && response.statusCode == 200) {
            onSuccess(data);
          } else {
            failParser(400, error ? error : data, onFail);
          }
        } catch (err) {
          onFail({
            errors: [{ code: 500, message: JSON.stringify(err) }]
          });
        }
      });
    },
    () => {
      failParser(
        500,
        "Dropbox token database is broken :( Please report this!",
        onFail
      );
    }
  );
}

function failParser(statusCode, message, failHandler) {
  return failHandler({
    errors: [
      {
        code: statusCode,
        message: message
      }
    ]
  });
}
