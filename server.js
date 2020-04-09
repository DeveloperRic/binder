const express = require("express");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const { handleError } = require("./config/globals");
const mongodb = require("./api/mongodb");

var app = express();

// DON'T FORGET TO MAKE THIS WEB APP HTTPS!!!
// ALSO MAKE SURE ALL MODULES USE THE UPDATED WEB ADDRESS!
//  modules to look out for:
//   - app.server.email
//   - app.server.source.onedrive.js
//
// TODO: DON'T FORGET TO RESTRICT APP_SECRET ORIGINS FOR ALL SOURCES
// TODO: verify GDrive/Onedrive/Dropbox Oauth with privacy policy etc.

app.use(logger("dev"));

app.use("/angular", express.static("./angular"));
app.use("/css", express.static("./css"));
app.use("/html", express.static("./html"));
app.use("/model", express.static("./model"));
app.use("/modules", express.static("./node_modules"));

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true,
  })
);
app.use(
  cors({
    origin: "http://localhost",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

app.use("/api", require("./api/api"));

app.route("/app.client.*").get((req, res) => {
  res.sendFile(req.path.substr(1), { root: "./html" });
});

app.route("/connect/*").get((req, res) => {
  res.sendFile("app.client.router.html", {
    root: "./html",
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
        root: "./html",
      });
    } else {
      res.sendFile("app.client.landing.html", { root: "./html" });
    }
  });
});

app.use((err, req, res, next) => {
  // console.error(err); // err.stack
  // res.status(500).send("Something broke!");
  handleError(res, err);
});

// --------------------------------------------------

// ensure database connection is established before handling requests
mongodb
  .connect()
  .then(() =>
    app.listen(8080, () => console.log("Binder server launched on port 8080"))
  )
  .catch(err => {
    console.error(err);
    console.log("Failed to launch Binder because of MongoDB error.");
  });
