const uuidv4 = require("uuid/v4");
const mongodb = require("./app.server.mongodb.js");

const USERS_COL_NAME = "user.users";
const USER_SESSIONS_COL_NAME = "user.sessions";

exports.newUser = function(email, password, onSuccess, onFail) {
  this.getUserWithEmailPassword(
    email,
    password,
    () => {
      // not a mongodb error + (user was found / password correct)
      onFail(false, true);
    },
    (mongodbError, userFound) => {
      if (mongodbError) {
        // a mongodb error occured
        onFail(true);
      } else if (userFound) {
        // not a mongodb error + (user was found / password incorrect)
        onFail(false, true);
      } else {
        mongodb.insertDocument(
          USERS_COL_NAME,
          newUserObject(email, password, [], 1),
          result => {
            onSuccess(result.ops[0]);
          },
          () => {
            // a mongodb error occured
            onFail(true);
          }
        );
      }
    }
  );
};

exports.getUserWithEmailPassword = function(
  email,
  password,
  onSuccess,
  onFail
) {
  mongodb.findDocuments(
    USERS_COL_NAME,
    { email: email },
    docs => {
      if (docs.length == 0) {
        // not a mongodb error + user was not found
        onFail(false, false);
      } else {
        var user = docs[0];
        if (user.password == password) {
          onSuccess(user);
        } else {
          // not a mongodb error + (user found / password is incorrect)
          onFail(false, true);
        }
      }
    },
    () => {
      // a mongodb error occured
      onFail(true);
    }
  );
};

exports.getUserWithUID = function(uid, onSuccess, onFail) {
  mongodb.findDocuments(
    USERS_COL_NAME,
    { uid: uid },
    docs => {
      if (docs.length == 0) {
        // not a mongodb error / user not found
        onFail(false);
      } else {
        onSuccess(docs[0]);
      }
    },
    () => {
      onFail(true);
    }
  );
};

exports.getUserWithSessionKey = function(uid, sessionKey, onSuccess, onFail) {
  verifyUserSessionKey(
    uid,
    sessionKey,
    () => {
      this.getUserWithUID(uid, onSuccess, onFail);
    },
    onFail
  );
};

exports.registerUserSession = function(uid, expiration, onSuccess, onFail) {
  this.endUserSession(
    uid,
    () => {
      var sessionKey = uuidv4();
      mongodb.insertDocument(
        USER_SESSIONS_COL_NAME,
        {
          uid: uid,
          key: sessionKey,
          expires: expiration
        },
        () => {
          onSuccess(sessionKey);
        },
        onFail
      );
    },
    onFail
  );
};

function verifyUserSessionKey(uid, sessionKey, onSuccess, onFail) {
  mongodb.findDocuments(
    USER_SESSIONS_COL_NAME,
    { uid: uid },
    docs => {
      if (docs.length == 0) {
        // not a mongodb error + session was not found
        onFail(false, false);
      } else {
        if (docs[0].key == sessionKey) {
          onSuccess();
        } else {
          // not a mongodb error + (session found / key is incorrect)
          onFail(false, true);
        }
      }
    },
    () => {
      // a mongodb error occured
      onFail(true);
    }
  );
}

exports.endUserSession = function(uid, onSuccess, onFail) {
  mongodb.removeDocument(
    USER_SESSIONS_COL_NAME,
    { uid: uid },
    onSuccess,
    onFail
  );
};

exports.addConnectedSource = function(uid, sourceId, onSuccess, onFail) {
  mongodb.updateDocument(
    USERS_COL_NAME,
    { uid: uid },
    {
      $addToSet: {
        connectedSources: sourceId
      }
    },
    onSuccess,
    () => {
      onFail(true);
    }
  );
};

exports.removeConnectedSource = function(uid, sourceId, onSuccess, onFail) {
  mongodb.updateDocument(
    USERS_COL_NAME,
    { uid: uid },
    {
      $pullAll: { connectedSources: sourceId }
    },
    onSuccess,
    () => {
      onFail(true);
    }
  );
};

exports.setAccessLevel = function(uid, newAccessLevel, onSuccess, onFail) {
  mongodb.updateDocumentField(
    USERS_COL_NAME,
    { uid: uid },
    { accessLevel: newAccessLevel, connectedSources: [] },
    () => {
      this.getUserWithUID(uid, onSuccess, onFail);
    },
    () => {
      onFail(true);
    }
  );
};

exports.updateProfile = function(uid, newValue, onSuccess, onFail) {
  mongodb.updateDocumentField(
    USERS_COL_NAME,
    { uid: uid },
    { profile: newValue },
    () => {
      this.getUserWithUID(uid, onSuccess, onFail);
    },
    () => {
      onFail(true);
    }
  );
};

exports.getNavigation = function(uid, onSuccess, onFail) {
  var nav = [
    {
      page: "dashboard",
      text: "Home"
    }
  ];
  this.getUserWithUID(
    uid,
    user => {
      if (user.connectedSources.includes("gdrive")) {
        nav.push({
          source: "gdrive",
          folder: "root",
          text: "Google Drive"
        });
      }
      if (user.connectedSources.includes("onedrive")) {
        nav.push({
          source: "onedrive",
          folder: "root",
          text: "Onedrive"
        });
      }
      onSuccess(nav);
    },
    () => {
      onFail(nav);
    }
  );
};

function newUserObject(email, password, connectedSources, accessLevel) {
  return {
    uid: uuidv4(),
    email: email,
    password: password,
    connectedSources: connectedSources,
    accessLevel: accessLevel,
    profile: {
      firstname: "User",
      lastname: "",
      avatar: null
    }
  };
}
