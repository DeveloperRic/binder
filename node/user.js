var fs = require("fs");

class User {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }
}

var users = [];

exports.loadUsers = function() {
  users = JSON.parse(fs.readFileSync("node/users", "utf8"));
  users.push(new User("admin", "admin"));
};

exports.getUser = function(username) {
  return Date();
};
