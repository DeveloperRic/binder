var express = require("express");
var app = express();

app.use("/node", express.static("./node"));
app.use("/angular", express.static("./angular"));
app.use("/css", express.static("./css"));
app.use("/html", express.static("./html"));
app.all("/*", function(req, res, next) {
  // Just send the index.html for other files to support HTML5Mode
  res.sendFile("index.html", { root: "./html" });
});

// --------------------------------------------------

var url = require("url");
var udb = require("./node/user");

udb.loadUsers();
//var q = url.parse(req.url, true);
app.listen(8080, ()=> {
  console.log("Binder launched on port 8080");
});
