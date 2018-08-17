const fs = require("fs");
const { google } = require("googleapis");

const mongodb = require("./app.server.mongodb.js");
const udb = require("../node/app.server.user");

const TOKENS_COL_NAME = "source.gdrive.credentials";

const drive = google.drive({ version: "v3" });

var client_secret;
var client_id;
var redirect_uris;

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

function getAuthSession(uid) {
  var authSession = null;
  authSessions.forEach(asession => {
    if (asession.uid == uid) {
      authSession = asession;
    }
  });
  return authSession;
}

function getAuth(uid, onSuccess, onFail) {
  getUserToken(
    uid,
    token => {
      if (token) {
        var oAuth2Client = new google.auth.OAuth2(
          client_id,
          client_secret,
          redirect_uris[0]
        );
        oAuth2Client.setCredentials(token);
        onSuccess(oAuth2Client);
      } else {
        onFail();
      }
    },
    onFail
  );
}

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
        getAccessToken(uid, onPrompt, onFail);
      }
    },
    () => {
      onFail({
        errors: [
          {
            code: 500,
            message: "gdrive token database is broken :( Please report this!"
          }
        ]
      });
    }
  );
};

function getAccessToken(uid, onPrompt, onFail) {
  udb.getUserWithUID(
    uid,
    user => {
      var oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPE_LEVELS[user.accessLevel]
      });
      var authSession = getAuthSession(uid);
      if (authSession != null) {
        authSession.authclient = oAuth2Client;
      } else {
        authSessions.push({ uid: uid, authclient: oAuth2Client });
      }
      onPrompt(authUrl);
    },
    mongodbError => {
      if (mongodbError) {
        onFail({
          errors: [
            {
              code: 500,
              message: "users database is broken :( Please report this!"
            }
          ]
        });
      } else {
        onFail({
          errors: [
            {
              code: 404,
              message: "User with uid (" + uid + ") could not be found!"
            }
          ]
        });
      }
    }
  );
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
        setUserToken(uid, token, onSuccess, () => {
          onFail({
            errors: [
              {
                code: 500,
                message: "Couldn't update user's gdrive access token"
              }
            ]
          });
        });
      }
    });
  } else {
    onFail({ errors: [{ code: 408, message: "Auth Session has expired" }] });
  }
};

exports.unAuthorize = function(uid, onSuccess, onFail) {
  setUserToken(uid, null, onSuccess, () => {
    onFail({
      errors: [{ code: 500, message: "Couldn't disconnect user's gdrive" }]
    });
  });
};

exports.listFiles = function(uid, folderId, params, onSuccess, onFail) {
  getAuth(
    uid,
    auth => {
      drive.files.list(
        Object.assign(
          {
            auth: auth,
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
    },
    () => {
      onFail({
        errors: [
          { code: 500, message: "Couldn't get the user's gdrive access token" }
        ]
      });
    }
  );
};

exports.getFile = function(uid, fileId, onSuccess, onFail) {
  getAuth(
    uid,
    auth => {
      drive.files.get(
        {
          auth: auth,
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
    },
    () => {
      onFail({
        errors: [
          { code: 500, message: "Couldn't get the user's gdrive access token" }
        ]
      });
    }
  );
};

exports.getFileMetadata = function(uid, fileId, keys, onSuccess, onFail) {
  getAuth(
    uid,
    auth => {
      var fields = "id";
      if (keys.length > 0) {
        keys.forEach(key => {
          fields += ", " + key;
        });
      }
      drive.files.get(
        {
          auth: auth,
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
    },
    () => {
      onFail({
        errors: [
          { code: 500, message: "Couldn't get the user's gdrive access token" }
        ]
      });
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
  getAuth(
    uid,
    auth => {
      drive.files.update(
        {
          auth: auth,
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
    },
    () => {
      onFail({
        errors: [
          { code: 500, message: "Couldn't get the user's gdrive access token" }
        ]
      });
    }
  );
};
