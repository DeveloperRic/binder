const router = require("express").Router();
const sdb = require("./sdb");
const udb = require("../user/udb");
const onedrive = require("./onedrive");
const dropbox = require("./dropbox");

const { verifyParams } = require("../../config/globals");

router.get("/list", (req, res) => {
  res.send(sdb.sources);
});

router.post("/:sourceId/begin_connect", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid", "body.forceUpdate"],
      req.params.sourceId,
      req.body.uid,
      req.body.forceUpdate
    )
  ) {
    return;
  }
  sdb
    .beginConnect(req.params.sourceId, req.body.uid, req.body.forceUpdate)
    .then(authUrl => {
      if (authUrl) {
        return res.status(206).send(authUrl);
      }
      udb
        .addConnectedSource(req.body.uid, req.params.sourceId)
        .then(() => res.sendStatus(200))
        .catch(mongodbError => {
          if (mongodbError) {
            res.sendStatus(500);
          } else {
            res.sendStatus(404);
          }
        });
    })
    .catch(next);
});

router.post("/:sourceId/finish_connect", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid", "body.code"],
      req.params.sourceId,
      req.body.uid,
      req.body.code
    )
  ) {
    return;
  }
  sdb
    .finishConnect(req.params.sourceId, req.body.uid, req.body.code)
    .then(() => {
      const onFail = mongodbError => {
        if (mongodbError) {
          res.sendStatus(500);
        } else {
          res.sendStatus(404);
        }
      };
      udb
        .addConnectedSource(req.body.uid, req.params.sourceId)
        .then(() => {
          udb
            .getUserWithUID(req.body.uid)
            .then(user => res.send(user))
            .catch(onFail);
        })
        .catch(onFail);
    })
    .catch(next);
});

router.post("/:sourceId/disconnect", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["params.sourceId", "body.uid"],
      req.params.sourceId,
      req.body.uid
    )
  ) {
    return;
  }
  sdb
    .disconnect(req.params.sourceId, req.body.uid)
    .then(() => {
      const onFailHandler = mongodbError => {
        if (mongodbError) {
          res.sendStatus(500);
        } else {
          res.sendStatus(404);
        }
      };
      udb
        .removeConnectedSource(req.body.uid, req.params.sourceId)
        .then(() => {
          udb
            .getUserWithUID(req.body.uid)
            .then(user => res.send(user))
            .catch(onFailHandler);
        })
        .catch(onFailHandler);
    })
    .catch(next);
});

router.get("/:sourceId/:folderId/files", (req, res, next) => {
  listSourceFiles(req, res, next, req.params.sourceId, req.params.folderId);
});

router.get("/dropbox/files", (req, res, next) => {
  listSourceFiles(req, res, next, "dropbox", req.query.folderPath);
});

function listSourceFiles(req, res, next, sourceId, folderId) {
  if (
    !verifyParams(
      res,
      ["query.uid", "sourceId", "folderId/folderPath", "query.params"],
      req.query.uid,
      sourceId,
      folderId,
      req.query.params
    )
  ) {
    return;
  }
  sdb
    .listFiles(
      req.query.uid,
      sourceId,
      folderId,
      req.query.pageToken,
      req.query.params
    )
    .then(([files, nextPageToken]) => {
      res.send({
        files: files,
        nextPageToken: nextPageToken,
      });
    })
    .catch(next);
}

router.get("/:sourceId/:fileId/get_metadata", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "params.sourceId", "params.fileId", "query.keys"],
      req.query.uid,
      req.params.sourceId,
      req.params.fileId,
      req.query.keys
    )
  ) {
    return;
  }
  sdb
    .getFileMetadata(
      req.query.uid,
      req.params.sourceId,
      req.params.fileId,
      req.query.keys
    )
    .then(file => res.send(file))
    .catch(next);
});

router.post("/:sourceId/:fileId/update_metadata", (req, res, next) => {
  updateFileMetadata(req, res, next, req.params.sourceId, req.params.fileId);
});

router.post("/dropbox/update_metadata", (req, res) => {
  updateFileMetadata(req, res, next, "dropbox", req.body.filePath);
});

function updateFileMetadata(req, res, next, sourceId, fileId) {
  if (
    !verifyParams(
      res,
      ["body.uid", "sourceId", "fileId/filePath", "body.metadata"],
      req.body.uid,
      sourceId,
      fileId,
      req.body.metadata
    )
  ) {
    return;
  }
  sdb
    .updateFileMetadata(req.body.uid, sourceId, fileId, req.body.metadata)
    .then(data => res.send(data))
    .catch(next);
}

router.get("/:sourceId/search", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "params.sourceId", "query.query", "query.params"],
      req.query.uid,
      req.params.sourceId,
      req.query.query,
      req.query.params
    )
  ) {
    return;
  }
  sdb
    .search(
      req.query.uid,
      req.params.sourceId,
      req.query.query,
      req.query.pageToken,
      req.query.params
    )
    .then(([files, nextPageToken]) => {
      res.send({
        files: files,
        nextPageToken: nextPageToken,
      });
    })
    .catch(next);
});

router.get("/onedrive/:fileId/collection/:collection", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "params.fileId", "params.collection"],
      req.query.uid,
      req.params.fileId,
      req.params.collection
    )
  ) {
    return;
  }
  // TODO remember to remove onedrive from app requirements if adding other sources
  onedrive
    .getFileCollection(req.query.uid, req.params.fileId, req.params.collection)
    .then(file => res.send(file))
    .catch(next);
});

router.get("/:sourceId/:fileId/content/*", (req, res, next) => {
  getFileContent(req, res, next, req.params.sourceId, req.params.fileId);
});

router.get("/dropbox/content", (req, res) => {
  getFileContent(req, res, next, "dropbox", req.query.filePath);
});

function getFileContent(req, res, next, sourceId, fileId) {
  if (
    !verifyParams(
      res,
      ["query.uid", "sourceId", "fileId/filePath"],
      req.query.uid,
      sourceId,
      fileId
    )
  ) {
    return;
  }
  sdb
    .getFileContent(req.query.uid, sourceId, fileId)
    .then(file => res.send(file))
    .catch(next);
}

router.get("/dropbox/preview", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "query.filePath"],
      req.query.uid,
      req.query.filePath
    )
  ) {
    return;
  }
  dropbox
    .getFilePreview(req.query.uid, req.query.filePath)
    .then(result => res.send(result))
    .catch(next);
});

router.get("/dropbox/thumbnails", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["query.uid", "query.filePaths"],
      req.query.uid,
      req.query.filePaths
    )
  ) {
    return;
  }
  dropbox
    .getFileThumbnails(req.query.uid, req.query.filePaths)
    .then(result => res.send(result.entries))
    .catch(next);
});

module.exports = router;
