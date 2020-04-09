const { google } = require("googleapis");
require("dotenv").config();

const mongodb = require("../mongodb");
const udb = require("../user/udb");

const TOKENS_COL_NAME = "source.gdrive.credentials";

const drive = google.drive({ version: "v3" });

const client_id = process.env.GOOGLE_CLOUD_AUTH_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLOUD_AUTH_CLIENT_SECRET;
const redirect_uri = process.env.GOOGLE_CLOUD_AUTH_REDIRECT_URI;

var authSessions = [];

// If modifying a user's scope, delete their credentials from database.
const SCOPE_LEVELS = [
  ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  ["https://www.googleapis.com/auth/drive"],
];

function getUserToken(uid) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(TOKENS_COL_NAME, { uid: uid })
      .then(docs => resolve(docs.length > 0 ? docs[0].token : null))
      .catch(reject);
  });
}

function setUserToken(uid, token) {
  return new Promise((resolve, reject) => {
    if (token != null) {
      mongodb
        .upsertDocument(TOKENS_COL_NAME, { uid: uid }, { token: token })
        .then(resolve)
        .catch(reject);
    } else {
      mongodb
        .removeDocument(TOKENS_COL_NAME, { uid: uid })
        .then(resolve)
        .catch(reject);
    }
  });
}

function resetUserToken(uid) {
  return setUserToken(uid, null);
}

function getAuthSession(uid) {
  for (const i in authSessions) {
    if (authSessions[i].uid == uid) return authSessions[i];
  }
  return null;
}

/**
 * @returns {Promise<google.auth.OAuth2>}
 */
function getAuth(uid) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(token => {
        if (!token) return reject();
        const oAuth2Client = new google.auth.OAuth2(
          client_id,
          client_secret,
          redirect_uri
        );
        oAuth2Client.setCredentials(token);
        resolve(oAuth2Client);
      })
      .catch(reject);
  });
}

/**
 * @returns {Promise<"authUrl"}
 */
function beginAuthorize(uid, forceUpdate) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(token => {
        if (token && !forceUpdate) return resolve();
        getAccessToken(uid).then(resolve).catch(reject);
      })
      .catch(err => {
        console.error(err);
        reject({
          errors: [
            {
              code: 500,
              message: "gdrive token database is broken :( Please report this!",
            },
          ],
        });
      });
  });
}

function getAccessToken(uid) {
  return new Promise((resolve, reject) => {
    udb
      .getUserWithUID(uid)
      .then(user => {
        const oAuth2Client = new google.auth.OAuth2(
          client_id,
          client_secret,
          redirect_uri
        );
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPE_LEVELS[user.accessLevel],
          prompt: "consent",
          redirect_uri: redirect_uri,
        });
        const authSession = getAuthSession(uid);
        if (authSession != null) {
          authSession.authclient = oAuth2Client;
        } else {
          authSessions.push({ uid: uid, authclient: oAuth2Client });
        }
        resolve(authUrl);
      })
      .catch(mongodbError => {
        if (mongodbError) {
          reject({
            errors: [
              {
                code: 500,
                message: "users database is broken :( Please report this!",
              },
            ],
          });
        } else {
          reject({
            errors: [
              {
                code: 404,
                message: "User with uid (" + uid + ") could not be found!",
              },
            ],
          });
        }
      });
  });
}

function finishAuthorize(uid, code) {
  return new Promise((resolve, reject) => {
    const authSession = getAuthSession(uid);
    if (authSession) {
      const oAuth2Client = authSession.authclient;
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token);
        if (!token.refresh_token) {
          getUserToken(uid)
            .then(userToken => {
              if (userToken && userToken.refresh_token) {
                token = Object.assign(token, {
                  refresh_token: userToken.refresh_token,
                });
              }
              assignUserToken();
            })
            .catch(err => {
              console.error(err);
              reject({
                errors: [
                  {
                    code: 500,
                    message:
                      "gdrive token database is broken :( Please report this!",
                  },
                ],
              });
            });
        } else {
          assignUserToken();
        }
        function assignUserToken() {
          setUserToken(uid, token)
            .then(resolve)
            .catch(err => {
              console.error(err);
              reject({
                errors: [
                  {
                    code: 500,
                    message: "Couldn't update user's gdrive access token",
                  },
                ],
              });
            });
        }
      });
    } else {
      reject({ errors: [{ code: 408, message: "Auth Session has expired" }] });
    }
  });
}

function unAuthorize(uid) {
  return new Promise((resolve, reject) => {
    setUserToken(uid, null)
      .then(resolve)
      .catch(err => {
        console.error(err);
        reject({
          errors: [{ code: 500, message: "Couldn't disconnect user's gdrive" }],
        });
      });
  });
}

function listFiles(uid, folderId, pageToken, params) {
  return new Promise((resolve, reject) => {
    getAuth(uid)
      .then(auth => {
        drive.files.list(
          Object.assign(
            {
              auth: auth,
              pageSize: 25,
              pageToken: pageToken,
              q: "'" + folderId + "' in parents",
              fields:
                "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, parents)",
            },
            params
          ),
          (err, res) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      })
      .catch(err => {
        console.error(err);
        reject({
          errors: [
            {
              code: 500,
              message: "Couldn't get the user's gdrive access token",
            },
          ],
        });
      });
  });
}

function getFile(uid, fileId) {
  return new Promise((resolve, reject) => {
    getAuth(uid)
      .then(auth => {
        drive.files.get(
          {
            auth: auth,
            fileId: fileId,
            fields: "items(id, name)",
          },
          (err, data) => {
            if (err) return reject(err);
            resolve(data);
          }
        );
      })
      .catch(err => {
        console.error(err);
        reject({
          errors: [
            {
              code: 500,
              message: "Couldn't get the user's gdrive access token",
            },
          ],
        });
      });
  });
}

function getFileMetadata(uid, fileId, keys) {
  return new Promise((resolve, reject) => {
    getAuth(uid)
      .then(auth => {
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
            fields: fields,
          },
          (err, res) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      })
      .catch(err => {
        console.error(err);
        reject({
          errors: [
            {
              code: 500,
              message: "Couldn't get the user's gdrive access token",
            },
          ],
        });
      });
  });
}

function updateFileMetadata(uid, fileId, metadata) {
  return new Promise((resolve, reject) => {
    getAuth(uid)
      .then(auth => {
        var fields = "id, name";
        for (let key in metadata) {
          if (!fields.includes(key)) {
            fields += ", " + key;
          }
        }
        drive.files.update(
          {
            auth: auth,
            fileId: fileId,
            uploadType: "multipart",
            resource: metadata,
            fields: fields,
          },
          (err, res) => {
            if (err) {
              console.log(JSON.stringify(err));
              reject(err);
            } else {
              resolve(res);
            }
          }
        );
      })
      .catch(err => {
        console.error(err);
        reject({
          errors: [
            {
              code: 500,
              message: "Couldn't get the user's gdrive access token",
            },
          ],
        });
      });
  });
}

module.exports = {
  resetUserToken,
  beginAuthorize,
  finishAuthorize,
  unAuthorize,
  listFiles,
  getFile,
  getFileMetadata,
  updateFileMetadata,
};
