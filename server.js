const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const url = require("url");
const udb = require("./node/app.server.user");
const sdb = require("./node/app.server.source");
const onedrive = require("./node/app.server.source.onedrive");

var app = express();

// DON'T FORGET TO MAKE THIS WEB APP HTTPS!!!

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
  //var q = url.parse(req.url, true);
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

app.route("/api/user/:uid").get((req, res) => {
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

app.route("/api/source/listsources").get((req, res) => {
  res.status(200).send(sdb.sources);
});

app.route("/api/source/beginconnect").post((req, res) => {
  var result = sdb.beginConnect(
    req.body.sourceid,
    req.body.uid,
    authUrl => {
      res.status(206).send(authUrl);
    },
    () => {
      var user = udb.getUserWithUID(req.body.uid);
      if (!user.connectedSources.includes(req.body.sourceid)) {
        user.connectedSources.push(req.body.sourceid);
      }
      res.sendStatus(200);
    },
    error => {
      res.status(error.errors[0].code).send(error.errors);
    }
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/finishconnect").post((req, res) => {
  var result = sdb.finishConnect(
    req.body.sourceid,
    req.body.uid,
    req.body.code,
    () => {
      var user = udb.getUserWithUID(req.body.uid);
      if (!user.connectedSources.includes(req.body.sourceid)) {
        user.connectedSources.push(req.body.sourceid);
        udb.saveUsers();
      }
      res.status(200).send(user);
    },
    error => {
      res.status(error.errors[0].code).send(error.errors);
    }
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/gdrive/extendscope").post((req, res) => {
  sdb.extendGDriveScope(
    req.body.uid,
    user => {
      user.connectedSources.splice(user.connectedSources.indexOf("gdrive"), 1);
      res.status(200).send(user);
    },
    () => {
      res
        .status(409)
        .send(
          "The user hasn't connected to Google Drive." +
            " Connect to it first before attempting to extend it's scope."
        );
    }
  );
});

app.route("/api/source/:sourceId/:folderId/listfiles").get((req, res) => {
  sdb.listFiles(
    req.query.uid,
    req.params.sourceId,
    req.params.folderId,
    req.query.params,
    files => {
      res.status(200).send(files);
    },
    error => {
      res
        .status(error.code ? error.code : error.errors[0].code)
        .send(error.errors);
    }
  );
});

app.route("/api/source/:sourceId/:fileId/getfilemetadata").get((req, res) => {
  sdb.getFileMetadata(
    req.query.uid,
    req.params.sourceId,
    req.params.fileId,
    req.query.keys,
    file => {
      res.status(200).send(file);
    },
    error => {
      res
        .status(error.code ? error.code : error.errors[0].code)
        .send(error.errors);
    }
  );
});

app.route("/api/source/updatefilemetadata").post((req, res) => {
  sdb.updateFileMetadata(
    req.body.uid,
    req.body.fileId,
    req.body.metadata,
    ({ data }) => {
      res.status(200).send(data);
    },
    error => {
      res.status(error.errors[0].code).send(error.errors);
    }
  );
});

app.route("/api/source/onedrive/:fileId/getfilecollection").get((req, res) => {
  // remember to remove onedrive from app requirements if adding other sources
  onedrive.getFileCollection(
    req.query.uid,
    req.params.fileId,
    req.query.collection,
    file => {
      res.status(200).send(file);
    },
    error => {
      res.status(error.errors[0].code).send(error.errors);
    }
  );
});

app.route("/api/source/onedrive/:fileId/content/*").get((req, res) => {
  onedrive.getFileContent(
    req.query.uid,
    req.params.fileId,
    file => {
      res.status(200).send(file);
    },
    error => {
      res
        .status(error.code ? error.code : error.errors[0].code)
        .send(error.errors);
    }
  );
});

app.route("/app.client.*").get((req, res) => {
  res.sendFile(req.originalUrl.substr(1), { root: "./html" });
});

app.route("/*").get((req, res) => {
  // Just send the index.html for other files to support HTML5Mode
  res.sendFile("app.client.router.html", { root: "./html" });
});

// --------------------------------------------------

var server = app.listen(8080, () => {
  udb.loadUsers();
  console.log("Binder server launched on port 8080");
});
