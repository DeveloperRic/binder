const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const mongodb = require("./node/app.server.mongodb");
const udb = require("./node/app.server.user");
const sdb = require("./node/app.server.source");
const onedrive = require("./node/app.server.source.onedrive");
const dropbox = require("./node/app.server.source.dropbox");
const email = require("./node/app.server.email");
const util = require("./node/app.server.util");

var app = express();

// DON'T FORGET TO MAKE THIS WEB APP HTTPS!!!
// ALSO MAKE SURE ALL MODULES USE THE UPDATED WEB ADDRESS!
//  modules to look out for:
//   - app.server.email
//   - app.server.source.onedrive.js
//
// TODO: DON'T FORGET TO RESTRICT APP_SECRET ORIGINS FOR ALL SOURCES

//app.use("/node", express.static("./node"));
app.use("/angular", express.static("./angular"));
app.use("/css", express.static("./css"));
app.use("/html", express.static("./html"));
app.use("/model", express.static("./model"));
app.use("/modules", express.static("./node_modules"));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true
  })
);
app.use(
  cors({
    origin: "http://localhost",
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

app.route("/api/user/new_user").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["body.email", "body.password"],
      req.body.email,
      req.body.password
    )
  ) {
    return;
  }
  udb.newUser(
    req.body.email,
    req.body.password,
    user => {
      udb.registerUserSession(
        user.uid,
        req.body.expiration,
        sessionKey => {
          delete user.password;
          res.status(201).send({ sessionKey: sessionKey, user: user });
        },
        () => {
          res.sendStatus(500);
        }
      );
    },
    mongodbError => {
      if (mongodbError) {
        res.sendStatus(500);
      } else {
        res.sendStatus(403);
      }
    }
  );
});

app.route("/api/user/login_user").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["body.email", "body.password", "body.expiration"],
      req.body.email,
      req.body.password,
      req.body.expiration
    )
  ) {
    return;
  }
  udb.getUserWithEmailPassword(
    req.body.email,
    req.body.password,
    user => {
      udb.registerUserSession(
        user.uid,
        req.body.expiration,
        sessionKey => {
          delete user.password;
          res.send({ sessionKey: sessionKey, user: user });
        },
        () => {
          res.sendStatus(500);
        }
      );
    },
    (mongodbError, userFound) => {
      if (mongodbError) {
        res.sendStatus(500);
      } else if (userFound) {
        res.sendStatus(401);
      } else {
        res.sendStatus(404);
      }
    }
  );
});

app.route("/api/user/:uid/logout").post((req, res) => {
  if (!verifyParams(res, ["params.uid"], req.params.uid)) {
    return;
  }
  udb.endUserSession(
    req.params.uid,
    () => {
      res.sendStatus(200);
    },
    () => {
      res.sendStatus(500);
    }
  );
});

app.route("/api/user/:uid").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.uid", "query.sessionKey"],
      req.params.uid,
      req.query.sessionKey
    )
  ) {
    return;
  }
  udb.getUserWithSessionKey(
    req.params.uid,
    req.query.sessionKey,
    user => {
      delete user.password;
      res.send(user);
    },
    (mongodbError, invalidSessionKey) => {
      if (mongodbError) {
        res.sendStatus(500);
      } else if (invalidSessionKey) {
        res.sendStatus(401);
      } else {
        res.sendStatus(404);
      }
    }
  );
});

app.route("/api/user/:uid/navigation").get((req, res) => {
  if (!verifyParams(res, ["params.uid"], req.params.uid)) {
    return;
  }
  udb.getNavigation(
    req.params.uid,
    nav => {
      res.send(nav);
    },
    nav => {
      res.status(500).send(nav);
    }
  );
});

app.route("/api/user/:uid/update_email").post((req, res) => {
  // TODO support email changes
  if (
    !verifyParams(
      res,
      ["params.uid", "body.newEmail", "body.password"],
      req.params.uid,
      req.body.newEmail,
      req.body.password
    )
  ) {
    return;
  }
  udb.updateEmailAddress(
    req.params.uid,
    req.body.newEmail,
    req.body.password,
    user => {
      delete user.password;
      res.send(user);
    },
    (mongodbError, emailTaken) => {
      if (mongodbError) {
        res.sendStatus(500);
      } else if (emailTaken) {
        res.sendStatus(403);
      } else {
        res.sendStatus(401);
      }
    }
  );
});

app.route("/api/user/:uid/update_profile").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.uid", "body.profile"],
      req.params.uid,
      req.body.profile
    )
  ) {
    return;
  }
  udb.updateProfile(
    req.params.uid,
    req.body.profile,
    user => {
      delete user.password;
      res.send(user);
    },
    mongodbError => {
      if (mongodbError) {
        res.sendStatus(500);
      } else {
        res.sendStatus(404);
      }
    }
  );
});

app.route("/api/user/:uid/set_access_level").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.uid", "body.newAccessLevel"],
      req.params.uid,
      req.body.newAccessLevel
    )
  ) {
    return;
  }
  udb.setAccessLevel(
    req.params.uid,
    req.body.newAccessLevel,
    user => {
      sdb.updateAccessLevels(req.params.uid, failedSources => {
        delete user.password;
        res.send({ user: user, failedSources: failedSources });
      });
    },
    mongodbError => {
      if (mongodbError) {
        res.sendStatus(500);
      } else {
        res.sendStatus(404);
      }
    }
  );
});

app.route("/api/source/list").get((req, res) => {
  res.send(sdb.sources);
});

app.route("/api/source/:sourceId/begin_connect").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid", "body.forceUpdate"],
      req.params.sourceId,
      req.body.uid,
      req.body.forceUpdate
    )
  ) {
    return;
  }
  var result = sdb.beginConnect(
    req.params.sourceId,
    req.body.uid,
    req.body.forceUpdate,
    authUrl => {
      res.status(206).send(authUrl);
    },
    () => {
      udb.addConnectedSource(
        req.body.uid,
        req.params.sourceId,
        () => {
          res.sendStatus(200);
        },
        mongodbError => {
          if (mongodbError) {
            res.sendStatus(500);
          } else {
            res.sendStatus(404);
          }
        }
      );
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/finish_connect").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid", "body.code"],
      req.params.sourceId,
      req.body.uid,
      req.body.code
    )
  ) {
    return;
  }
  var result = sdb.finishConnect(
    req.params.sourceId,
    req.body.uid,
    req.body.code,
    () => {
      var onFailHandler = function(mongodbError) {
        if (mongodbError) {
          res.sendStatus(500);
        } else {
          res.sendStatus(404);
        }
      };
      udb.addConnectedSource(
        req.body.uid,
        req.params.sourceId,
        () => {
          udb.getUserWithUID(
            req.body.uid,
            user => {
              res.send(user);
            },
            onFailHandler
          );
        },
        onFailHandler
      );
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/disconnect").post((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid"],
      req.params.sourceId,
      req.body.uid
    )
  ) {
    return;
  }
  var result = sdb.disconnect(
    req.params.sourceId,
    req.body.uid,
    () => {
      var onFailHandler = mongodbError => {
        if (mongodbError) {
          res.sendStatus(500);
        } else {
          res.sendStatus(404);
        }
      };
      udb.removeConnectedSource(
        req.body.uid,
        req.params.sourceId,
        () => {
          udb.getUserWithUID(
            req.body.uid,
            user => {
              res.send(user);
            },
            onFailHandler
          );
        },
        onFailHandler
      );
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/:folderId/files").get((req, res) => {
  listSourceFiles(req, res, req.params.sourceId, req.params.folderId);
});

app.route("/api/source/dropbox/files").get((req, res) => {
  listSourceFiles(req, res, "dropbox", req.query.folderPath);
});

function listSourceFiles(req, res, sourceId, folderId) {
  if (
    !verifyParams(
      res,
      ["query.uid", "sourceId", "folderId/folderPath", "query.params"],
      req.query.uid,
      sourceId,
      folderId,
      req.query.params
    )
  ) {
    return;
  }
  sdb.listFiles(
    req.query.uid,
    sourceId,
    folderId,
    req.query.pageToken,
    req.query.params,
    (files, nextPageToken) => {
      res.send({ files: files, nextPageToken: nextPageToken });
    },
    error => handleError(res, error)
  );
}

app.route("/api/source/:sourceId/:fileId/get_metadata").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "params.sourceId", "params.fileId", "query.keys"],
      req.query.uid,
      req.params.sourceId,
      req.params.fileId,
      req.query.keys
    )
  ) {
    return;
  }
  sdb.getFileMetadata(
    req.query.uid,
    req.params.sourceId,
    req.params.fileId,
    req.query.keys,
    file => {
      res.send(file);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/gdrive/:fileId/update_metadata").post((req, res) => {
  // TODO metadata updates should work for all sources
  if (
    !verifyParams(
      res,
      ["body.uid", "params.fileId", "body.metadata"],
      req.body.uid,
      req.params.fileId,
      req.body.metadata
    )
  ) {
    return;
  }
  sdb.updateFileMetadata(
    req.body.uid,
    req.params.fileId,
    req.body.metadata,
    ({ data }) => {
      res.send(data);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/:sourceId/search").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "params.sourceId", "query.query", "query.params"],
      req.query.uid,
      req.params.sourceId,
      req.query.query,
      req.query.params
    )
  ) {
    return;
  }
  sdb.search(
    req.query.uid,
    req.params.sourceId,
    req.query.query,
    req.query.pageToken,
    req.query.params,
    (files, nextPageToken) => {
      res.send({ files: files, nextPageToken: nextPageToken });
    },
    error => handleError(res, error)
  );
});

app
  .route("/api/source/onedrive/:fileId/collection/:collection")
  .get((req, res) => {
    if (
      !verifyParams(
        res,
        ["query.uid", "params.fileId", "params.collection"],
        req.query.uid,
        req.params.fileId,
        req.params.collection
      )
    ) {
      return;
    }
    // TODO remember to remove onedrive from app requirements if adding other sources
    onedrive.getFileCollection(
      req.query.uid,
      req.params.fileId,
      req.params.collection,
      file => {
        res.send(file);
      },
      error => handleError(res, error)
    );
  });

app.route("/api/source/:sourceId/:fileId/content/*").get((req, res) => {
  getFileContent(req, res, req.params.sourceId, req.params.fileId);
});

app.route("/api/source/dropbox/content").get((req, res) => {
  getFileContent(req, res, "dropbox", req.query.filePath);
});

function getFileContent(req, res, sourceId, fileId) {
  if (
    !verifyParams(
      res,
      ["query.uid", "sourceId", "fileId/filePath"],
      req.query.uid,
      sourceId,
      fileId
    )
  ) {
    return;
  }
  sdb.getFileContent(
    req.query.uid,
    sourceId,
    fileId,
    file => {
      res.send(file);
    },
    error => handleError(res, error)
  );
}

app.route("/api/source/dropbox/preview").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "query.filePath"],
      req.query.uid,
      req.query.filePath
    )
  ) {
    return;
  }
  dropbox.getFilePreview(
    req.query.uid,
    req.query.filePath,
    result => {
      res.send(result);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/dropbox/thumbnails").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "query.filePaths"],
      req.query.uid,
      req.query.filePaths
    )
  ) {
    return;
  }
  dropbox.getFileThumbnails(
    req.query.uid,
    req.query.filePaths,
    result => {
      res.send(result.entries);
    },
    error => handleError(res, error)
  );
});

app.route("/api/email/:templateId/send").post((req, res) => {
  // email is disabled right now due to its current unstable nature
  //
  // update this vvv
  // if (!verifyParams(req.params.templateId, req.body.uid, req.body.placeholders)) {
  //   return;
  // }
  //
  // email.send(
  //   req.params.templateId,
  //   req.body.uid,
  //   req.body.placeholders,
  //   () => res.sendStatus(200),
  //   (code, err) => {
  //     res.status(code).send(err);
  //     console.log(err);
  //   }
  // );
  res.sendStatus(200);
});

app.route("/email/:templateId").get((req, res) => {
  if (
    !verifyParams(
      res,
      ["params.templateId", "query.uid"],
      req.params.templateId,
      req.query.uid
    )
  ) {
    return;
  }
  email.viewOnline(req.params.templateId, req.query.uid, content => {
    res.send(content);
  });
});

app.route("/app.client.*").get((req, res) => {
  res.sendFile(req.path.substr(1), { root: "./html" });
});

app.route("/connect/*").get((req, res) => {
  res.sendFile("app.client.router.html", {
    root: "./html"
  });
});

app.route("/*").get((req, res) => {
  var path = req.path.substr(1);
  if (path.includes("/")) {
    path = path.substr(0, path.indexOf("/"));
  }
  fs.exists("./html/app.client.stage." + path + ".html", exists => {
    if (exists) {
      res.sendFile("app.client.router.html", {
        root: "./html"
      });
    } else {
      res.sendFile("app.client.landing.html", { root: "./html" });
    }
  });
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

function verifyParams(res, names, ...params) {
  for (let i in params) {
    if (params[i] == null) {
      res.status(400).send("Missing body/param/query item -> " + names[i]);
      return false;
    }
  }
  return true;
}

function handleError(res, error) {
  try {
    res
      .status(error.code ? error.code : error.errors[0].code)
      .send(error.errors ? error.errors : error);
  } catch (e) {
    try {
      res.status(500).send(error);
    } catch (e1) {
      console.log(error);
      res.sendStatus(500);
    }
  }
}

// --------------------------------------------------

// ensure database connection is established before handling requests
mongodb.connect(
  () => {
    app.listen(8080, () => {
      console.log("Binder server launched on port 8080");
    });
  },
  err => {
    console.error(err);
    console.log("Failed to launch Binder because of MongoDB error.");
  }
);
