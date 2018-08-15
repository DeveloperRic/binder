const fs = require("fs");
const { google } = require("googleapis");

const udb = require("../node/app.server.user");

const TOKEN_PATH = "server_data/app.server.source.gdrive.credentials.json";
const drive = google.drive({ version: "v3" });

var client_secret;
var client_id;
var redirect_uris;

var userTokens = [];
var authSessions = [];

// If modifying a user's scope, delete their credentials from gdrive.credentials.json.
const SCOPE_LEVELS = [
  ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  ["https://www.googleapis.com/auth/drive"]
];

exports.init = function() {
  // Load client secrets from a local file.
  fs.readFile(
    "server_data/app.server.source.gdrive.client_secret.json",
    (err, content) => {
      if (err) {
        if (err.code == "ENOENT") {
          return console.log("Couldn't find gdrive client secret!");
        } else {
          return console.log("Error loading gdrive client secret file: ", err);
        }
      }
      const credentials = JSON.parse(content).installed;
      client_secret = credentials.client_secret;
      client_id = credentials.client_id;
      redirect_uris = credentials.redirect_uris;
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
  for (let i in userTokens) {
    if (userTokens[i].uid == uid) {
      return userTokens[i].token;
    }
  }
  return null;
}

function setUserToken(uid, token) {
  var userToken = getUserToken(uid);
  if (userToken == null && token != null) {
    // if a token doesn't exist and there is a token to add
    userTokens.push({ uid: uid, token: token });
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
    userToken = token;
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

function getAuthSession(uid) {
  var authSession = null;
  authSessions.forEach(asession => {
    if (asession.uid == uid) {
      authSession = asession;
    }
  });
  return authSession;
}

function getAuth(uid) {
  var oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  oAuth2Client.setCredentials(getUserToken(uid));
  return oAuth2Client;
}

exports.beginAuthorize = function(uid, forceUpdate, onPrompt, onSuccess) {
  var oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  var userToken = getUserToken(uid);
  if (userToken && !forceUpdate) {
    oAuth2Client.setCredentials(userToken);
    onSuccess();
  } else {
    getAccessToken(uid, oAuth2Client, onPrompt);
  }
};

function getAccessToken(uid, oAuth2Client, onPrompt) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPE_LEVELS[udb.getUserWithUID(uid).accessLevel]
  });
  var authSession = getAuthSession(uid);
  if (authSession != null) {
    authSession.authclient = oAuth2Client;
  } else {
    authSessions.push({ uid: uid, authclient: oAuth2Client });
  }
  onPrompt(authUrl);
}

exports.finishAuthorize = function(uid, code, onSuccess, onFail) {
  var authSession = getAuthSession(uid);
  if (authSession) {
    var oAuth2Client = authSession.authclient;
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        onFail(err);
      } else {
        oAuth2Client.setCredentials(token);
        setUserToken(uid, token);
        onSuccess();
      }
    });
  } else {
    onFail({ errors: [{ code: 408, message: "Auth Session has expired" }] });
  }
};

exports.unAuthorize = function(uid, onSuccess, onFail) {
  setUserToken(uid, null);
  if (getUserToken(uid) == null) {
    onSuccess();
  } else {
    onFail({
      errors: [
        { code: 500, message: "Couldn't disconnect user's google drive" }
      ]
    });
  }
};

exports.listFiles = function(uid, folderId, params, onSuccess, onFail) {
  drive.files.list(
    Object.assign(
      {
        auth: getAuth(uid),
        pageSize: 28,
        q: "'" + folderId + "' in parents",
        fields:
          "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, thumbnailLink)"
      },
      params
    ),
    (err, res) => {
      if (err) {
        onFail(err);
      } else {
        onSuccess(res);
      }
    }
  );
};

exports.getFile = function(uid, fileId, onSuccess, onFail) {
  drive.files.get(
    {
      auth: getAuth(uid),
      fileId: fileId,
      fields: "items(id, name)"
    },
    (error, data) => {
      if (error) {
        onFail(error);
      } else {
        onSuccess(data);
      }
    }
  );
};

exports.getFileMetadata = function(uid, fileId, keys, onSuccess, onFail) {
  var fields = "id";
  if (keys.length > 0) {
    keys.forEach(key => {
      fields += ", " + key;
    });
  }
  drive.files.get(
    {
      auth: getAuth(uid),
      fileId: fileId,
      fields: fields
    },
    (err, res) => {
      if (err) {
        onFail(err);
      } else {
        onSuccess(res);
      }
    }
  );
};

exports.updateFileMetadata = function(
  uid,
  fileId,
  metadata,
  onSuccess,
  onFail
) {
  drive.files.update(
    {
      auth: getAuth(uid),
      fileId: fileId,
      metadata: metadata
    },
    (err, res) => {
      if (err) {
        console.log(JSON.stringify(err));
        onFail(err);
      } else {
        onSuccess(res);
      }
    }
  );
};
