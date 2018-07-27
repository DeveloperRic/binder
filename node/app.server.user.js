const fs = require("fs");
const uuidv4 = require("uuid/v4");

const USERS_FILE_PATH = "server_data/app.server.user.users.json";
const USER_SESSIONS_FILE_PATH = "server_data/app.server.user.sessions.json";

var users = [];
var userSessions = [];

// DON'T FORGET TO SECURE USERS WITH NON-SEQUENTIAL IDS AND RANDOMIZED SESSION KEYS!!!

exports.loadUsers = function() {
  fs.readFile(USERS_FILE_PATH, (err, content) => {
    if (err) {
      if (err.code == "ENOENT") {
        this.saveUsers();
      } else {
        return console.log("Error loading users: ", err);
      }
    }
    users = JSON.parse(content);
  });
  fs.readFile(USER_SESSIONS_FILE_PATH, (err, content) => {
    if (err) {
      if (err.code == "ENOENT") {
        saveUserSessions();
      } else {
        return console.log("Error loading user sessions: ", err);
      }
    }
    userSessions = JSON.parse(content);
  });
};

exports.newUser = function(email, password) {
  var result = {
    access: false,
    user: null
  };
  if (this.getUserWithEmailPassword(email, password).user == null) {
    var user = newUserObject(uuidv4(), email, password, [], 0);
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

exports.getUserWithSessionKey = function(uid, sessionKey) {
  return {
    access: verifyUserSessionKey(uid, sessionKey),
    user: this.getUserWithUID(uid)
  };
};

exports.saveUsers = function() {
  fs.writeFile(USERS_FILE_PATH, JSON.stringify(users), err => {
    if (err) console.error(err);
  });
};

exports.registerUserSession = function(uid, expiration) {
  this.endUserSession(uid);
  var sessionKey = uuidv4();
  userSessions.push({ uid: uid, key: sessionKey, expires: expiration });
  saveUserSessions();
  return sessionKey;
};

function verifyUserSessionKey(uid, sessionKey) {
  for (let i in userSessions) {
    let session = userSessions[i];
    if (session.uid == uid && session.key == sessionKey) {
      return new Date(session.expires) > new Date();
    }
  }
  return false;
}

exports.endUserSession = function(uid) {
  var newList = [];
  userSessions.forEach(session => {
    if (session.uid != uid) {
      newList.push(session);
    }
  });
  userSessions = newList;
};

function saveUserSessions() {
  fs.writeFile(USER_SESSIONS_FILE_PATH, JSON.stringify(userSessions), err => {
    if (err) console.error(err);
  });
}

function newUserObject(
  uid,
  email,
  password,
  connectedSources,
  driveScopeLevel
) {
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
