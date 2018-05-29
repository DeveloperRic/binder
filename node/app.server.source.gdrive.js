const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// If modifying these scopes, delete gdrive.credentials.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"];
const TOKEN_PATH = "node/app.server.source.gdrive.credentials.json";
const drive = google.drive({ version: "v3" });

var client_secret;
var client_id;
var redirect_uris;

var userTokens = [];
var authSessions = [];

exports.init = function() {
  // Load client secrets from a local file.
  fs.readFile(
    "node/app.server.source.gdrive.client_secret.json",
    (err, content) => {
      if (err) return console.log("Error loading client secret file: ", err);
      const credentials = JSON.parse(content);
      client_secret = credentials.installed.client_secret;
      client_id = credentials.installed.client_id;
      redirect_uris = credentials.installed.redirect_uris;
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
      userToken = utoken.token;
    }
  });
  return userToken;
}

function setUserToken(uid, token) {
  var userToken = getUserToken(uid);
  if (userToken == null) {
    userTokens.push({ uid: uid, token: token });
  } else {
    userToken = token;
  }
  saveUserTokens();
}

function saveUserTokens() {
  fs.writeFile(TOKEN_PATH, JSON.stringify(userTokens), err => {
    if (err) console.error(err);
  });
}

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

exports.beginAuthorize = function(uid, onPrompt, onSuccess) {
  var oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  var userToken = getUserToken(uid);
  if (userToken != null) {
    oAuth2Client.setCredentials(userToken);
    onSuccess();
  } else {
    getAccessToken(uid, oAuth2Client, onPrompt);
  }
};

function getAccessToken(uid, oAuth2Client, onPrompt) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
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
  if (authSession != null) {
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
    onFail({ error: { code: 408, message: "Auth Session has expired" } });
  }
};

exports.listFolders = function(uid, onSuccess, onFail) {
  drive.files.list(
    {
      auth: getAuth(uid),
      pageSize: 10,
      q: "mimeType='application/vnd.google-apps.folder'",
      fields: "nextPageToken, files(id, name, mimeType, parents)"
    },
    (err, {data}) => {
      if (err) {
        onFail(err);
      } else {
        onSuccess(data);
      }
    }
  );
};

exports.listFiles = function(uid, onSuccess, onFail) {
  drive.files.list(
    {
      auth: getAuth(uid),
      pageSize: 10,
      q: "mimeType!='application/vnd.google-apps.folder'",
      fields: "nextPageToken, files(id, name, parents)"
    },
    (err, {data}) => {
      if (err) {
        onFail(err);
      } else {
        onSuccess(data);
      }
    }
  );
};
