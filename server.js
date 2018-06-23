const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const url = require("url");
const udb = require("./node/app.server.user");
const sdb = require("./node/app.server.source");

var app = express();

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
    res.status(201).send(result.user.toJSON());
  } else {
    res.sendStatus(403);
  }
});

app.route("/api/user/getuser").post((req, res) => {
  //var q = url.parse(req.url, true);
  var result = udb.getUserWithEmailPassword(req.body.email, req.body.password);
  if (result.user != null) {
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
  res.status(200).send(JSON.stringify(sdb.sources));
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
    }
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

var fs = require("fs");

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
      res.status(error.code).send(JSON.stringify(error.errors));
    }
  );
  if (result != 100) {
    res.sendStatus(result);
  }
});

app.route("/api/source/gdrive/extendscope").put((req, res) => {
  sdb.extendGDriveScope(req.body.uid, user => {
    res.status(200).send(user);
  });
});

app.route("/api/source/startfilelist").post((req, res) => {
  sdb.listFiles(
    req.body.uid,
    req.body.folderId,
    ({ data }) => {
      res.status(200).send(JSON.stringify(data.files));
    },
    error => {
      res.status(error.code).send(JSON.stringify(error.errors));
    }
  );
});

app.route("/api/source/getfilemetadata").post((req, res) => {
  sdb.getFileMetadata(
    req.body.uid,
    req.body.fileId,
    req.body.keys,
    ({ data }) => {
      res.status(200).send(JSON.stringify(data));
    },
    error => {
      res.status(error.code).send(JSON.stringify(error.errors));
    }
  );
});

app.route("/api/source/updatefilemetadata").post((req, res) => {
  sdb.updateFileMetadata(
    req.body.uid,
    req.body.fileId,
    req.body.metadata,
    ({ data }) => {
      res.status(200).send(JSON.stringify(data));
    },
    error => {
      res.status(error.code).send(JSON.stringify(error.errors));
    }
  );
});

app.route("/*").get((req, res) => {
  // Just send the index.html for other files to support HTML5Mode
  res.sendFile("index.html", { root: "./html" });
});

// --------------------------------------------------

var server = app.listen(8080, () => {
  udb.loadUsers();
  console.log("Binder server launched on port 8080");
});
