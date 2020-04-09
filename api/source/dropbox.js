const fs = require("fs");
const request = require("request");
require("dotenv").config();

const mongodb = require("../mongodb");

const TOKENS_COL_NAME = "source.dropbox.credentials";
const DROPBOX_API_DOMAIN = "https://api.dropboxapi.com/2";

const app_secret = {
  client_id: process.env.DROPBOX_AUTH_CLIENT_ID,
  client_secret: process.env.DROPBOX_AUTH_CLIENT_SECRET,
  redirect_uri: process.env.DROPBOX_AUTH_REDIRECT_URI,
};

// TODO: enable cross-site request forgery protection
// see: https://www.dropbox.com/developers/documentation/http/documentation#oauth2-authorize

function getUserToken(uid) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(TOKENS_COL_NAME, { uid: uid })
      .then(docs => resolve(docs.length == 0 ? null : docs[0].token))
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

/**
 * @returns {Promise<"authUrl">}
 */
function beginAuthorize(uid, forceUpdate) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(token => {
        if (token && !forceUpdate) return resolve();
        resolve(
          "https://www.dropbox.com/oauth2/authorize" +
            "?client_id=" +
            app_secret.client_id +
            "&response_type=code" +
            "&redirect_uri=" +
            encodeURIComponent(app_secret.redirect_uri)
        );
      })
      .catch(err => {
        console.error(err);
        failParser(
          500,
          "Dropbox token database is broken :( Please report this!",
          reject
        );
      });
  });
}

function finishAuthorize(uid, code) {
  return sendAuthorizationRequest(uid, {
    grant_type: "authorization_code",
    code: code,
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
      "https://api.dropboxapi.com/oauth2/token",
      {
        form: options,
      },
      (error, response, body) => {
        var data = body;
        try {
          data = JSON.parse(body);
        } catch (err1) {}
        if (!error && response.statusCode == 200) {
          setUserToken(uid, data)
            .then(resolve)
            .catch(err => {
              console.error(err);
              failParser(
                500,
                "Couldn't update user's dropbox access token",
                reject
              );
            });
        } else {
          failParser(400, error ? error : data, reject);
        }
      }
    );
  });
}

function unAuthorize(uid) {
  return new Promise((resolve, reject) => {
    setUserToken(uid, null)
      .catch(resolve)
      .catch(err => {
        console.error(err);
        failParser(500, "Couldn't disconnect user's dropbox", reject);
      });
  });
}

function listFiles(uid, folderPath, cursor) {
  return new Promise((resolve, reject) => {
    let requestUrl = DROPBOX_API_DOMAIN + "/files/list_folder";
    let requestParams;
    if (!!cursor) {
      requestUrl += "/continue";
      requestParams = {
        cursor: cursor,
      };
    } else {
      requestParams = {
        path: folderPath == "root" ? "" : folderPath,
        limit: 25,
      };
    }
    sendRequest(uid, requestUrl, requestParams).then(resolve).catch(reject);
  });
}

function updateFileMetadata(uid, filePath, metadata) {
  return new Promise((resolve, reject) => {
    if (Object.keys(metadata).length != 1) {
      return failParser(
        400,
        "Binder-Dropbox API can only update 1 metadata item at a time.",
        reject
      );
    }
    var key = Object.keys(metadata)[0];
    switch (key) {
      case "name":
        sendRequest(uid, DROPBOX_API_DOMAIN + "/files/move_v2", {
          from_path: filePath,
          to_path: metadata.name,
          allow_shared_folder: true,
          autorename: false,
          allow_ownership_transfer: false,
        })
          .then(resolve)
          .catch(reject);
        break;
      default:
        failParser(400, "Metadata key (" + key + ") is not supported.", reject);
    }
  });
}

function getFileThumbnails(uid, filePaths) {
  return new Promise((resolve, reject) => {
    let entries = [];
    filePaths.forEach(filePath => {
      entries.push({
        path: filePath,
        format: "jpeg",
        size: "w64h64",
        mode: "strict",
      });
    });
    sendRequest(
      uid,
      "https://content.dropboxapi.com/2/files/get_thumbnail_batch",
      {
        entries: entries,
      }
    )
      .then(resolve)
      .catch(reject);
  });
}

function getFilePreview(uid, filePath) {
  return sendRequest(
    uid,
    "https://content.dropboxapi.com/2/files/get_preview",
    null,
    {
      "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
    }
  );
}

function getContentLink(uid, filePath) {
  return sendRequest(uid, DROPBOX_API_DOMAIN + "/files/get_temporary_link", {
    path: filePath,
  });
}

function search(uid, query, startIndex) {
  return sendRequest(uid, DROPBOX_API_DOMAIN + "/files/search", {
    path: "",
    query: query,
    start: !!startIndex ? startIndex : 0,
    max_results: 25,
    mode: "filename",
  });
}

function sendRequest(uid, requestUrl, requestBody, headers) {
  return new Promise((resolve, reject) => {
    getUserToken(uid)
      .then(userToken => {
        // check user token is still valid
        if (userToken == null) {
          return failParser(
            403,
            "The user doesn't have a dropbox access token!",
            reject
          );
        }
        // send the request via GET protocol
        let requestOptions = {
          headers: {
            Authorization: "Bearer " + userToken.access_token,
            Accept: "application/json",
          },
          json: true,
        };
        if (headers) {
          requestOptions.headers = Object.assign(
            requestOptions.headers,
            headers
          );
        }
        if (requestBody) {
          requestOptions = Object.assign(requestOptions, {
            body: requestBody,
          });
        }
        request.post(requestUrl, requestOptions, (error, response, body) => {
          let data = body;
          try {
            try {
              data = JSON.parse(body);
            } catch (err1) {}
            if (!error && response.statusCode == 200) {
              resolve(data);
            } else {
              failParser(400, error ? error : data, reject);
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
          "Dropbox token database is broken :( Please report this!",
          reject
        );
      });
  });
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
  updateFileMetadata,
  getFileThumbnails,
  getFilePreview,
  getContentLink,
  search,
};
