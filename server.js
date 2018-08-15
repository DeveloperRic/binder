const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const fs = require("fs");
const udb = require("./node/app.server.user");
const sdb = require("./node/app.server.source");
const onedrive = require("./node/app.server.source.onedrive");
const email = require("./node/app.server.email");

var app = express();

// DON'T FORGET TO MAKE THIS WEB APP HTTPS!!!
// ALSO MAKE SURE ALL MODULES USE THE UPDATED IP ADDRESS!
//  modules to look out for:
//   - app.server.email
//   - app.server.source.onedrive.js

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

app.route("/api/user/newuser").post((req, res) => {
  if (!verifyParams(req.body.email, req.body.password)) {
    res.sendStatus(400);
    return;
  }
  var result = udb.newUser(req.body.email, req.body.password);
  if (result.access) {
    var sessionKey = udb.registerUserSession(
      result.user.uid,
      req.body.expiration
    );
    res.status(201).send({ sessionKey: sessionKey, user: result.user });
  } else {
    res.sendStatus(403);
  }
});

app.route("/api/user/loginuser").post((req, res) => {
  if (!verifyParams(req.body.email, req.body.password, req.body.expiration)) {
    res.sendStatus(400);
    return;
  }
  var result = udb.getUserWithEmailPassword(req.body.email, req.body.password);
  if (result.user) {
    if (result.access) {
      var sessionKey = udb.registerUserSession(
        result.user.uid,
        req.body.expiration
      );
      res.status(200).send({ sessionKey: sessionKey, user: result.user });
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(404);
  }
});

app.route("/api/user/logoutuser").post((req, res) => {
  if (!verifyParams(req.body.uid)) {
    res.sendStatus(400);
    return;
  }
  udb.endUserSession(req.body.uid);
  res.sendStatus(200);
});

app.route("/api/user/:uid").get((req, res) => {
  if (!verifyParams(req.params.uid, req.query.sessionKey)) {
    res.sendStatus(400);
    return;
  }
  var result = udb.getUserWithSessionKey(req.params.uid, req.query.sessionKey);
  if (result.user) {
    if (result.access) {
      res.status(200).send(result.user);
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(404);
  }
});

app.route("/api/user/:uid/navigation").get((req, res) => {
  if (!verifyParams(req.params.uid)) {
    res.sendStatus(400);
    return;
  }
  res.status(200).send(udb.getNavigation(req.params.uid));
});

app.route("/api/user/:uid/update/:key").post((req, res) => {
  if (!verifyParams(req.params.uid, req.params.key, req.body[req.params.key])) {
    res.sendStatus(400);
    return;
  }
  res
    .status(200)
    .send(
      udb.updateProfile(
        req.params.uid,
        req.params.key,
        req.body[req.params.key]
      )
    );
});

app.route("/api/user/:uid/setaccesslevel").post((req, res) => {
  if (!verifyParams(req.params.uid, req.body.newAccessLevel)) {
    res.sendStatus(400);
    return;
  }
  var user = udb.setAccessLevel(req.params.uid, req.body.newAccessLevel);
  var failedSources = sdb.updateAccessLevels(req.params.uid);
  res.status(200).send({ user: user, failedSources: failedSources });
});

app.route("/api/source/list").get((req, res) => {
  res.status(200).send(sdb.sources);
});

app.route("/api/source/:sourceId/beginconnect").post((req, res) => {
  if (!verifyParams(req.params.sourceId, req.body.uid, req.body.forceUpdate)) {
    res.sendStatus(400);
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
      var user = udb.getUserWithUID(req.body.uid);
      if (!user.connectedSources.includes(req.params.sourceId)) {
        user.connectedSources.push(req.params.sourceId);
      }
      res.sendStatus(200);
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/finishconnect").post((req, res) => {
  if (!verifyParams(req.params.sourceId, req.body.uid, req.body.code)) {
    res.sendStatus(400);
    return;
  }
  var result = sdb.finishConnect(
    req.params.sourceId,
    req.body.uid,
    req.body.code,
    () => {
      var user = udb.getUserWithUID(req.body.uid);
      if (!user.connectedSources.includes(req.params.sourceId)) {
        user.connectedSources.push(req.params.sourceId);
        udb.saveUsers();
      }
      res.status(200).send(user);
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/disconnect").post((req, res) => {
  if (!verifyParams(req.params.sourceId, req.body.uid)) {
    res.sendStatus(400);
    return;
  }
  var result = sdb.disconnect(
    req.params.sourceId,
    req.body.uid,
    () => {
      var user = udb.getUserWithUID(req.body.uid);
      if (user.connectedSources.includes(req.params.sourceId)) {
        user.connectedSources.splice(
          user.connectedSources.indexOf(req.params.sourceId),
          1
        );
        udb.saveUsers();
      }
      res.status(200).send(user);
    },
    error => handleError(res, error)
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/:sourceId/:folderId/children").get((req, res) => {
  if (
    !verifyParams(
      req.query.uid,
      req.params.sourceId,
      req.params.folderId,
      req.query.params
    )
  ) {
    res.sendStatus(400);
    return;
  }
  sdb.listFiles(
    req.query.uid,
    req.params.sourceId,
    req.params.folderId,
    req.query.params,
    files => {
      res.status(200).send(files);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/:sourceId/:fileId/getfilemetadata").get((req, res) => {
  if (
    !verifyParams(
      req.query.uid,
      req.params.sourceId,
      req.params.fileId,
      req.query.keys
    )
  ) {
    res.sendStatus(400);
    return;
  }
  sdb.getFileMetadata(
    req.query.uid,
    req.params.sourceId,
    req.params.fileId,
    req.query.keys,
    file => {
      res.status(200).send(file);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/updatefilemetadata").post((req, res) => {
  // TODO metadata updates should work for all sources
  if (!verifyParams(req.body.uid, req.body.fileId, req.body.metadata)) {
    res.sendStatus(400);
    return;
  }
  sdb.updateFileMetadata(
    req.body.uid,
    req.body.fileId,
    req.body.metadata,
    ({ data }) => {
      res.status(200).send(data);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/:sourceId/search").get((req, res) => {
  if (
    !verifyParams(
      req.query.uid,
      req.params.sourceId,
      req.query.query,
      req.query.params
    )
  ) {
    res.sendStatus(400);
    return;
  }
  sdb.search(
    req.query.uid,
    req.params.sourceId,
    req.query.query,
    req.query.params,
    files => {
      res.status(200).send(files);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/onedrive/:fileId/collection/:collection").get((req, res) => {
  if (!verifyParams(req.query.uid, req.params.fileId, req.params.collection)) {
    res.sendStatus(400);
    return;
  }
  // TODO remember to remove onedrive from app requirements if adding other sources
  onedrive.getFileCollection(
    req.query.uid,
    req.params.fileId,
    req.params.collection,
    file => {
      res.status(200).send(file);
    },
    error => handleError(res, error)
  );
});

app.route("/api/source/onedrive/:fileId/content/*").get((req, res) => {
  if (!verifyParams(req.query.uid, req.params.fileId)) {
    res.sendStatus(400);
    return;
  }
  onedrive.getFileContent(
    req.query.uid,
    req.params.fileId,
    file => {
      res.status(200).send(file);
    },
    error => handleError(res, error)
  );
});

app.route("/api/email/:templateId/send").post((req, res) => {
  // email is disabled right now due to its current unstable nature
  //
  // if (!verifyParams(req.params.templateId, req.body.uid, req.body.placeholders)) {
  //   res.sendStatus(400);
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
  if (!verifyParams(req.params.templateId, req.query.uid)) {
    res.sendStatus(400);
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

function verifyParams(...params) {
  for (let i in params) {
    if (params[i] == null) {
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
    res.status(500).send(error);
  }
}

// --------------------------------------------------

var server = app.listen(8080, () => {
  udb.loadUsers();
  console.log("Binder server launched on port 8080");
});
