const router = require("express").Router();

const udb = require("./udb");
const sdb = require("../source/sdb");

const G = require("../../config/globals");

router.post("/new_user", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["body.email", "body.password"],
      req.body.email,
      req.body.password
    )
  ) {
    return;
  }
  udb
    .newUser(req.body.email, req.body.password, user, mongodbError)
    .then((user) =>
      udb
        .registerUserSession(user.uid, req.body.expiration)
        .then((sessionKey) => {
          delete user.password;
          res.status(201).send({ sessionKey: sessionKey, user: user });
        })
        .catch(() => res.sendStatus(500))
    )
    .catch((mongodbError) => {
      if (mongodbError) {
        res.sendStatus(500);
      } else {
        res.sendStatus(403);
      }
    });
});

router.post("/login_user", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["body.email", "body.password", "body.expiration"],
      req.body.email,
      req.body.password,
      req.body.expiration
    )
  ) {
    return;
  }
  udb
    .getUserWithEmailPassword(req.body.email, req.body.password)
    .then((user) => {
      if (!user) return res.sendStatus(404);
      udb
        .registerUserSession(user.uid, req.body.expiration)
        .then((sessionKey) => {
          delete user.password;
          res.send({ sessionKey: sessionKey, user: user });
        })
        .catch((err) => {
          console.error(err);
          res.sendStatus(500);
        });
    })
    .catch((mongodbError) => {
      console.error(mongodbError);
      res.sendStatus(500);
    });
});

router.post("/:uid/logout", (req, res) => {
  if (!G.verifyParams(res, ["params.uid"], req.params.uid)) {
    return;
  }
  udb
    .endUserSession(req.params.uid)
    .then(() => res.sendStatus(200))
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

router.get("/:uid", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["params.uid", "query.sessionKey"],
      req.params.uid,
      req.query.sessionKey
    )
  ) {
    return;
  }
  udb
    .getUserWithSessionKey(req.params.uid, req.query.sessionKey)
    .then((user) => {
      if (!user) return res.sendStatus(404);
      delete user.password;
      res.send(user);
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

router.get("/:uid/navigation", (req, res) => {
  if (!G.verifyParams(res, ["params.uid"], req.params.uid)) {
    return;
  }
  udb
    .getNavigation(req.params.uid)
    .then((nav) => res.send(nav))
    .catch((err) => {
      console.error(err);
      res.status(500).send([]);
    });
});

router.post("/:uid/update_email", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["params.uid", "body.newEmail", "body.password"],
      req.params.uid,
      req.body.newEmail,
      req.body.password
    )
  ) {
    return;
  }
  udb
    .updateEmailAddress(req.params.uid, req.body.newEmail, req.body.password)
    .then((user) => {
      if (!user) return res.sendStatus(403);
      delete user.password;
      res.send(user);
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(err);
    });
});

router.post("/:uid/update_profile", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["params.uid", "body.profile"],
      req.params.uid,
      req.body.profile
    )
  ) {
    return;
  }
  udb
    .updateProfile(req.params.uid, req.body.profile)
    .then((user) => {
      delete user.password;
      res.send(user);
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

router.post("/:uid/set_access_level", (req, res) => {
  if (
    !G.verifyParams(
      res,
      ["params.uid", "body.newAccessLevel"],
      req.params.uid,
      req.body.newAccessLevel
    )
  ) {
    return;
  }
  udb
    .setAccessLevel(req.params.uid, req.body.newAccessLevel)
    .then((user) => {
      sdb.updateAccessLevels(req.params.uid, (failedSources) => {
        delete user.password;
        res.send({ user: user, failedSources: failedSources });
      });
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

module.exports = router;
