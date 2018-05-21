
var express = require('express');
var app = express();var http = require("http");

app.use('/node', express.static('./node'));
app.use('/angular', express.static('./angular'));
app.use('/css', express.static('./css'));
app.all('/*', function(req, res, next) {
    // Just send the index.html for other files to support HTML5Mode
    res.sendFile('index.html', { root: './html' });
});

// --------------------------------------------------

var url = require("url");
var fs = require("fs");
var udb = require("./node/user");

udb.loadUsers();

http
  .createServer(function(req, res) {
    fs.readFile("html/index.html", function(err, data) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write(data);
      res.end();
    });

    var q = url.parse(req.url, true);
  })
  .listen(8080);
