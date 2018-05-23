var fs = require("fs");

class User {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  toJSON() {
    return {
      username: this.username,
      password: this.password
    };
  }
}

var users = [];

exports.loadUsers = function() {
  users = JSON.parse(fs.readFileSync("node/users", "utf8"));
  users.push(new User("admin", "admin"));
};

exports.getUser = function(username, password) {
  console.log(username + " " + password);
  var result = {
    access: false,
    user: null
  };
  users.forEach(user => {
    if (user.username == username) {
      if (user.password == password) {
        result = {
          access: true,
          user: user
        };
      } else {
        result = {
          access: false,
          user: user
        };
      }
    }
  });
  return result;
};
