const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');

const url = require("url");
const udb = require("./node/user");

var app = express();

app.use("/node", express.static("./node"));
app.use("/angular", express.static("./angular"));
app.use("/css", express.static("./css"));
app.use("/html", express.static("./html"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(cors({
  origin: 'http://localhost',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204 
}));

app.route("/api/getuser").post((req, res) => {
  //var q = url.parse(req.url, true);
  var result = udb.getUser(req.body.username, req.body.password);
  console.log(result);
  if (result.user != null) {
    if (result.access) {
      res.status(200).send(result.user.toJSON());
    } else {
      res.sendStatus(401);
    }
  } else {
    res.sendStatus(404);
  }
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
