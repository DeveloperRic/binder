const fs = require("fs");
const request = require("request");
require("dotenv").config();

const mongodb = require("../mongodb");
const udb = require("../user/udb");

const TOKENS_COL_NAME = "source.onedrive.credentials";
const MICROSOFT_GRAPH_DOMAIN = "https://graph.microsoft.com/v1.0";

const app_secret = {
  client_id: process.env.AZURE_AUTH_CLIENT_ID,
  client_secret: process.env.AZURE_AUTH_CLIENT_SECRET,
  redirect_uri: process.env.AZURE_AUTH_REDIRECT_URI,
};

// If modifying a user's scope, delete their credentials from database.
const SCOPE_LEVELS = [
  "user.read files.read.all",
  "user.read files.readwrite.all",
];

function getUserToken(uid) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(TOKENS_COL_NAME, { uid: uid })
      .then(docs => resolve(docs.length == 0 ? null : docs[0]))
      .catch(reject);
  });
}

function setUserToken(uid, token) {
  return new Promise((resolve, reject) => {
    if (token != null) {
      var expiry = new Date();
      expiry.setTime(expiry.getTime() + (token.expires_in - 10) * 1000);
      // expiry.setTime(expiry.getTime() + 10000);

      mongodb
        .upsertDocument(
          TOKENS_COL_NAME,
          { uid: uid },
          { token: token, expires: expiry.getTime() }
        )
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

/**
 * @returns {Promise<"authUrl">}
 */
function beginAuthorize(uid, forceUpdate) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(token => {
        if (token && !forceUpdate) {
          if (new Date().getTime() < token.expires) {
            resolve();
          } else {
            refreshAccessToken(uid).then(resolve).catch(reject);
          }
        } else {
          udb
            .getUserWithUID(uid)
            .then(user =>
              resolve(
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" +
                  "?client_id=" +
                  app_secret.client_id +
                  "&response_type=code" +
                  "&redirect_uri=" +
                  encodeURIComponent(app_secret.redirect_uri) +
                  "&scope=" +
                  encodeURIComponent(
                    "offline_access " + SCOPE_LEVELS[user.accessLevel]
                  )
              )
            )
            .catch(err => {
              console.error(err);
              if (err) {
                failParser(
                  500,
                  "onedrive token database is broken :( Please report this!",
                  reject
                );
              } else {
                failParser(
                  404,
                  "User with uid (" + uid + ") could not be found!",
                  reject
                );
              }
            });
        }
      })
      .catch(err => {
        console.error(err);
        failParser(
          500,
          "onedrive token database is broken :( Please report this!",
          reject
        );
      });
  });
}

function finishAuthorize(uid, code) {
  return new Promise((resolve, reject) => {
    sendAuthorizationRequest(uid, {
      grant_type: "authorization_code",
      code: code,
    })
      .then(resolve)
      .catch(reject);
  });
}

function refreshAccessToken(uid) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(userToken => {
        sendAuthorizationRequest(uid, {
          grant_type: "refresh_token",
          refresh_token: userToken.token.refresh_token,
        })
          .then(resolve)
          .catch(reject);
      })
      .catch(err => {
        console.error(err);
        failParser(
          500,
          "onedrive token database is broken :( Please report this!",
          reject
        );
      });
  });
}

function sendAuthorizationRequest(uid, authOptions) {
  return new Promise((resolve, reject) => {
    let options = {
      client_id: app_secret.client_id,
      client_secret: app_secret.client_secret,
      grant_type: authOptions.grant_type,
      redirect_uri: app_secret.redirect_uri,
    };
    if (authOptions.code) {
      options = Object.assign(options, { code: authOptions.code });
    }
    if (authOptions.refresh_token) {
      options = Object.assign(options, {
        refresh_token: authOptions.refresh_token,
      });
    }
    request.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        form: options,
      },
      (error, response, body) => {
        var data = JSON.parse(body);
        if (!error && response.statusCode == 200) {
          setUserToken(uid, data)
            .then(resolve)
            .catch(err => {
              console.error(err);
              failParser(
                500,
                "Couldn't update user's onedrive access token",
                reject
              );
            });
        } else {
          reject(parseErrorJSON(response.statusCode, data));
        }
      }
    );
  });
}

function unAuthorize(uid) {
  return new Promise((resolve, reject) => {
    setUserToken(uid, null)
      .then(resolve)
      .catch(err => {
        console.error(err);
        failParser(500, "Couldn't disconnect user's onedrive", reject);
      });
  });
}

function listFiles(uid, folderId, pageToken, params) {
  return new Promise((resolve, reject) => {
    let requestUrl = "/me/drive/items/" + folderId + "/children";
    if (!!pageToken) {
      requestUrl = pageToken.replace(MICROSOFT_GRAPH_DOMAIN, "");
    } else {
      if (folderId == "root") {
        requestUrl = "/drive/root/children";
      }
      requestUrl += "?select=id,name,folder,webUrl,size,parentReference&top=25";
      if (params) {
        requestUrl +=
          "&" +
          Object.keys(params)
            .map(function (key) {
              return key.toLowerCase() + "=" + encodeURIComponent(params[key]);
            })
            .join("&");
      }
    }
    sendRequest(uid, requestUrl).then(resolve).catch(reject);
  });
}

function getFileMetadata(uid, fileId, keys) {
  return new Promise((resolve, reject) => {
    let fields = "id";
    if (keys.length > 0) {
      keys.forEach(key => {
        fields += "," + key;
      });
    }
    sendRequest(uid, "/me/drive/items/" + fileId + "?select=" + fields)
      .then(resolve)
      .catch(reject);
  });
}

function updateFileMetadata(uid, fileId, metadata) {
  return new Promise((resolve, reject) => {
    let fields = "id, name";
    for (let key in metadata) {
      if (!fields.includes(key)) {
        fields += ", " + key;
      }
    }
    sendRequest(uid, "/me/drive/items/" + fileId + "?select=" + fields, {
      method: "PATCH",
      json: true,
      body: metadata,
    })
      .then(resolve)
      .catch(reject);
  });
}

function getFileCollection(uid, fileId, collection) {
  return sendRequest(uid, "/me/drive/items/" + fileId + "/" + collection);
}

function getFileContent(uid, fileId) {
  return sendRequest(uid, "/me/drive/items/" + fileId + "/content");
}

function search(uid, query, pageToken, params) {
  return new Promise((resolve, reject) => {
    let requestUrl = "/me/drive/root/search(q='" + query + "')";
    if (!!pageToken) {
      requestUrl = pageToken.replace(MICROSOFT_GRAPH_DOMAIN, "");
    } else {
      requestUrl += "?select=id,name,folder,webUrl,size,searchResult&top=25";
      if (params) {
        requestUrl +=
          "&" +
          Object.keys(params)
            .map(function (key) {
              return key.toLowerCase() + "=" + encodeURIComponent(params[key]);
            })
            .join("&");
      }
    }
    sendRequest(uid, requestUrl).then(resolve).catch(reject);
  });
}

function sendRequest(uid, requestUrl, requestOptions, refreshed) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(userToken => {
        // check user token is still valid
        if (userToken == null) {
          return failParser(
            403,
            "The user doesn't have a onedrive access token!",
            reject
          );
        }
        if (new Date().getTime() >= userToken.expires) {
          if (!refreshed) {
            refreshAccessToken(uid)
              .then(() =>
                sendRequest(uid, requestUrl, requestOptions, true)
                  .then(resolve)
                  .catch(reject)
              )
              .catch(reject);
          } else {
            unAuthorize(uid)
              .then(() => {
                udb
                  .removeConnectedSource(req.body.uid, "onedrive")
                  .then(() =>
                    failParser(
                      500,
                      "The user's onedrive access token is broken :(",
                      reject
                    )
                  )
                  .catch(err => {
                    console.error(err);
                    failParser(
                      500,
                      "users database is broken :( Please report this!",
                      reject
                    );
                  });
              })
              .catch(err => {
                console.error(err);
                failParser(
                  500,
                  "Storage of onedrive tokens is broken :( Please report this!",
                  reject
                );
              });
          }
          return;
        }

        const options = Object.assign(
          {
            uri: MICROSOFT_GRAPH_DOMAIN + requestUrl,
            method: "GET",
            headers: {
              Authorization: "Bearer " + userToken.token.access_token,
              Accept: "application/json",
            },
          },
          requestOptions
        );
        request(options, (error, response, body) => {
          var data = body;
          try {
            try {
              data = JSON.parse(body);
            } catch (err1) {}
            if (!error && response.statusCode == 200) {
              resolve(data);
            } else {
              reject(parseErrorJSON(response.statusCode, data));
            }
          } catch (err) {
            reject({
              errors: [{ code: 500, message: JSON.stringify(err) }],
            });
          }
        });
      })
      .catch(err => {
        console.error(err);
        failParser(
          500,
          "onedrive token database is broken :( Please report this!",
          reject
        );
      });
  });
}

function parseErrorJSON(statusCode, data) {
  return {
    errors: [
      {
        code: statusCode,
        desc: data.code ? data.code : data.error,
        message: data.message ? data.message : data.error_description,
        innerError: data.innerError ? data.innerError : data,
      },
    ],
  };
}

function failParser(statusCode, message, failHandler) {
  return failHandler({
    errors: [
      {
        code: statusCode,
        message: message,
      },
    ],
  });
}

module.exports = {
  resetUserToken,
  beginAuthorize,
  finishAuthorize,
  unAuthorize,
  listFiles,
  getFileMetadata,
  updateFileMetadata,
  getFileCollection,
  getFileContent,
  search,
};
