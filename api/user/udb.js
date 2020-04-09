const uuidv4 = require("uuid/v4");

const mongodb = require("../mongodb");
const sdb_sources = require("../source/sources");

const USERS_COL_NAME = "user.users";
const USER_SESSIONS_COL_NAME = "user.sessions";

function newUser(email, password) {
  return new Promise((reject, resolve) => {
    getUserWithEmailPassword(email, password)
      .resolve(user => {
        // user found
        if (user) return resolve();
        // user not found
        mongodb
          .insertDocument(USERS_COL_NAME, newUserObject(email, password, [], 1))
          .then(result => {
            resolve(result.ops[0]);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

function getUserWithEmailPassword(email, password) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(USERS_COL_NAME, { email: email })
      .then(docs => {
        if (docs.length == 0) {
          // not a mongodb error + user was not found
          return resolve(false); // (false false)
        } else {
          var user = docs[0];
          if (user.password == password) {
            resolve(user);
          } else {
            // not a mongodb error + (user found / password is incorrect)
            resolve(false); // (false, true)
          }
        }
      })
      .catch(err => {
        // a mongodb error occured
        reject(err); // (true)
      });
  });
}

function getUserWithUID(uid) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(USERS_COL_NAME, { uid: uid })
      .then(docs => {
        if (docs.length == 0) return reject();
        resolve(docs[0]);
      })
      .catch(reject);
  });
}

function getUserWithSessionKey(uid, sessionKey) {
  return new Promise((resolve, reject) => {
    verifyUserSessionKey(uid, sessionKey)
      .then(() => getUserWithUID(uid).then(resolve).catch(reject))
      .catch(reject);
  });
}

function registerUserSession(uid, expiration) {
  return new Promise((resolve, reject) => {
    endUserSession(uid)
      .then(() => {
        var sessionKey = uuidv4();
        mongodb
          .insertDocument(USER_SESSIONS_COL_NAME, {
            uid: uid,
            key: sessionKey,
            expires: expiration,
          })
          .then(() => resolve(sessionKey))
          .catch(reject);
      })
      .catch(reject);
  });
}

function verifyUserSessionKey(uid, sessionKey) {
  return new Promise((resolve, reject) => {
    mongodb
      .findDocuments(USER_SESSIONS_COL_NAME, { uid: uid })
      .then(docs => {
        if (docs.length == 0 || docs[0].key != sessionKey) {
          return reject();
        }
        resolve();
      })
      .catch(reject);
  });
}

function endUserSession(uid) {
  return mongodb.removeDocument(USER_SESSIONS_COL_NAME, { uid: uid });
}

function addConnectedSource(uid, sourceId) {
  return mongodb.updateDocument(
    USERS_COL_NAME,
    { uid: uid },
    {
      $addToSet: {
        connectedSources: sourceId,
      },
    }
  );
}

function removeConnectedSource(uid, sourceId) {
  return mongodb.updateDocument(
    USERS_COL_NAME,
    { uid: uid },
    {
      $pull: { connectedSources: sourceId },
    }
  );
}

function setAccessLevel(uid, newAccessLevel) {
  return new Promise((resolve, reject) => {
    mongodb
      .updateDocumentField(
        USERS_COL_NAME,
        { uid: uid },
        { accessLevel: newAccessLevel, connectedSources: [] }
      )
      .then(() => getUserWithUID(uid).then(resolve).catch(reject))
      .catch(reject);
  });
}

function updateEmailAddress(uid, newEmail, password) {
  return new Promise((resolve, reject) => {
    getUserWithEmailPassword(newEmail, "password not relevant")
      .then(user => {
        if (user) return resolve();
        getUserWithUID(uid)
          .then(user => {
            if (user.password != password) return reject();
            const updateDoc = { email: newEmail };
            mongodb
              .updateDocumentField(USERS_COL_NAME, { uid: uid }, updateDoc)
              .then(() => resolve(Object.assign(user, updateDoc)))
              .catch(reject);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

function updateProfile(uid, newValue) {
  return new Promise((resolve, reject) => {
    mongodb
      .updateDocumentField(USERS_COL_NAME, { uid: uid }, { profile: newValue })
      .then(() => getUserWithUID(uid).then(resolve).catch(reject))
      .catch(reject);
  });
}

function getNavigation(uid) {
  return new Promise((resolve, reject) => {
    getUserWithUID(uid)
      .then(user =>
        resolve(
          sdb_sources.reduce((acc, source) => {
            if (!user.connectedSources.includes(source.id)) return acc;
            acc.push({
              source: source.id,
              folder: "root",
              text: source.name,
            });
            return acc;
          }, [])
        )
      )
      .catch(reject);
  });
}

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
      avatar: null,
    },
  };
}

module.exports = {
  newUser,
  getUserWithEmailPassword,
  getUserWithUID,
  getUserWithSessionKey,
  registerUserSession,
  endUserSession,
  addConnectedSource,
  removeConnectedSource,
  setAccessLevel,
  updateEmailAddress,
  updateProfile,
  getNavigation,
};
