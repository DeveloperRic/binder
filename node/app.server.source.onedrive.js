const fs = require("fs");
const request = require("request");
const mongodb = require("./app.server.mongodb");

const udb = require("../node/app.server.user");

const TOKENS_COL_NAME = "source.onedrive.credentials";
const MICROSOFT_GRAPH_DOMAIN = "https://graph.microsoft.com/v1.0";

var app_secret;

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
          return console.log(
            "Error loading onedrive client secret file: ",
            err
          );
        }
      }
      app_secret = JSON.parse(content);
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
      onFail(true);
    }
  );
}

function setUserToken(uid, token, onSuccess, onFail) {
  if (token != null) {
    var expiry = new Date();
    // expiry.setTime(expiry.getTime() + (token.expires_in - 10) * 1000);
    expiry.setTime(expiry.getTime() + 1000);

    mongodb.upsertDocument(
      TOKENS_COL_NAME,
      { uid: uid },
      { token: token, expires: expiry.getTime() },
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
        if (new Date().getTime() < token.expires) {
          onSuccess();
        } else {
          refreshAccessToken(uid, onSuccess, onFail);
        }
      } else {
        udb.getUserWithUID(
          uid,
          user => {
            var url =
              "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" +
              "?client_id=" +
              app_secret.client_id +
              "&response_type=code" +
              "&redirect_uri=" +
              encodeURIComponent(
                "https://binder-211420.appspot.com/connect/onedrive"
              ) +
              // "&redirect_uri=" +
              // encodeURIComponent("http://localhost:8080/connect/onedrive") +
              "&scope=" +
              encodeURIComponent(
                "offline_access " + SCOPE_LEVELS[user.accessLevel]
              );
            onPrompt(url);
          },
          mongodbError => {
            if (mongodbError) {
              onFail({
                errors: [
                  {
                    code: 500,
                    message:
                      "onedrive token database is broken :( Please report this!"
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
    },
    () => {
      onFail({
        errors: [
          {
            code: 500,
            message: "onedrive token database is broken :( Please report this!"
          }
        ]
      });
    }
  );
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
        setUserToken(uid, token, onSuccess, () => {
          onFail({
            errors: [
              {
                code: 500,
                message: "Couldn't update user's onedrive access token"
              }
            ]
          });
        });
        onSuccess();
      } else {
        onFail(parseErrorJSON(response.statusCode, data));
      }
    }
  );
};

function refreshAccessToken(uid, onSuccess, onFail) {
  getUserToken(
    uid,
    token => {
      request.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          form: {
            client_id: app_secret.client_id,
            redirect_uri: encodeURIComponent(
              "http://localhost:8080/connect/onedrive"
            ),
            client_secret: app_secret.client_secret,
            refresh_token: token.refresh_token,
            grant_type: "refresh_token"
          }
        },
        (error, response, body) => {
          var data = JSON.parse(body);
          if (!error && response.statusCode == 200) {
            setUserToken(uid, data, onSuccess, () => {
              onFail({
                errors: [
                  {
                    code: 500,
                    message: "Couldn't update user's onedrive token"
                  }
                ]
              });
            });
          } else {
            onFail(parseErrorJSON(response.statusCode, data));
          }
        }
      );
    },
    () => {
      onFail({
        errors: [
          {
            code: 500,
            message: "onedrive token database is broken :( Please report this!"
          }
        ]
      });
    }
  );
}

function unAuthorize(uid, onSuccess, onFail) {
  setUserToken(uid, null, onSuccess, () => {
    onFail({
      errors: [{ code: 500, message: "Couldn't disconnect user's onedrive" }]
    });
  });
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

exports.search = function(uid, query, params, onSuccess, onFail) {
  var requestUrl = "/me/drive/root/search(q='" + query + "')";
  requestUrl += "?select=id,name,folder,webUrl,size,searchResult&top=28";
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

function sendRequest(uid, requestUrl, onSuccess, onFail, refreshed) {
  getUserToken(
    uid,
    userToken => {
      // check user token is still valid
      if (userToken == null) {
        return onFail({
          errors: [
            {
              code: 403,
              message: "The user doesn't have a onedrive access token!"
            }
          ]
        });
      }
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
              udb.removeConnectedSource(
                req.body.uid,
                "onedrive",
                () => {
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
                          "users database is broken :( Please report this!"
                      }
                    ]
                  });
                }
              );
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
    },
    () => {
      onFail({
        errors: [
          {
            code: 500,
            message: "onedrive token database is broken :( Please report this!"
          }
        ]
      });
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
