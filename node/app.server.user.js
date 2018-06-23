const fs = require("fs");

const USERS_FILE_PATH = "server_data/app.server.user.users.json";
var users = [];

exports.loadUsers = function() {
  users = JSON.parse(fs.readFileSync(USERS_FILE_PATH, "utf8"));
};

exports.newUser = function(email, password) {
  var result = {
    access: false,
    user: null
  };
  if (this.getUserWithEmailPassword(email, password).user == null) {
    var user = newUserObject(users.length, email, password, [], 0);
    users.push(user);
    this.saveUsers();
    result = {
      access: true,
      user: user
    };
  } else {
    result = {
      access: false,
      user: null
    };
  }
  return result;
};

exports.getUserWithEmailPassword = function(email, password) {
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

exports.getUserWithUID = function(uid) {
  var user = null;
  users.forEach(auser => {
    if (auser.uid == uid) {
      user = auser;
    }
  });
  return user;
};

exports.saveUsers = function() {
  fs.writeFile(USERS_FILE_PATH, JSON.stringify(users), err => {
    if (err) console.error(err);
  });
};

function newUserObject(uid, email, password, connectedSources, driveScopeLevel) {
  return {
    uid: uid,
    email: email,
    password: password,
    connectedSources: connectedSources,
    drive: {
      scopeLevel: driveScopeLevel
    }
  };
}
