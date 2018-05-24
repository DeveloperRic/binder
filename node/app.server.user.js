var fs = require("fs");
User = require("../model/app.module.user");

var users = [];

exports.loadUsers = function() {
  users = JSON.parse(fs.readFileSync("node/users", "utf8"));
  users.push(new User(0, "a@d.min", "admin"));
};

exports.newUser = function(email, password) {
  return new User(users.length, email, password);
};

exports.getUser = function(email, password) {
  var result = {
    access: false,
    user: null
  };
  users.forEach(user => {
    if (user.email == email) {
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
