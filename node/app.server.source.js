Source = require("../model/app.model.source");
const gdrive = require("./app.server.source.gdrive");
const onedrive = require("./app.server.source.onedrive");

exports.sources = [
  new Source("gdrive", "Google Drive"),
  new Source("onedrive", "Onedrive"),
  //new Source("onedrive365", "Office 365")
  new Source("dropbox", "Dropbox")
];

exports.getSource = function(sourceId) {
  var source = null;
  this.sources.forEach(asource => {
    if (asource.id == sourceId) {
      source = source;
    }
  });
  return source;
};

gdrive.init();
onedrive.init();

exports.beginConnect = function(
  sourceId,
  uid,
  forceUpdate,
  onPrompt,
  onSuccess,
  onFail
) {
  switch (sourceId) {
    case "gdrive":
      gdrive.beginAuthorize(uid, forceUpdate, onPrompt, onSuccess, onFail);
      break;
    case "onedrive":
      onedrive.beginAuthorize(uid, forceUpdate, onPrompt, onSuccess, onFail);
      break;
    case "onedrive365":
      return 501;

    default:
      return 400;
  }
  return 100;
};

exports.finishConnect = function(sourceId, uid, code, onSuccess, onFail) {
  switch (sourceId) {
    case "gdrive":
      gdrive.finishAuthorize(uid, code, onSuccess, onFail);
      break;
    case "onedrive":
      onedrive.finishAuthorize(uid, code, onSuccess, onFail);
      break;

    default:
      return 400;
  }
  return 100;
};

exports.disconnect = function(sourceId, uid, onSuccess, onFail) {
  switch (sourceId) {
    case "gdrive":
      gdrive.unAuthorize(uid, onSuccess, onFail);
      break;
    case "onedrive":
      onedrive.unAuthorize(uid, onSuccess, onFail);
      break;

    default:
      return 400;
  }
  return 100;
};

exports.updateAccessLevels = function(uid, onComplete) {
  var completedCount = 0;
  var failedSources = [];
  var checkComplete = function() {
    completedCount++;
    if (completedCount == 2) {
      onComplete(failedSources);
    }
  };
  gdrive.resetUserToken(
    uid,
    checkComplete,
    () => {
      failedSources.push("gdrive");
      checkComplete();
    }
  );
  onedrive.resetUserToken(
    uid,
    checkComplete,
    () => {
      failedSources.push("onedrive");
      checkComplete();
    }
  );
};

exports.listFiles = function(
  uid,
  sourceId,
  folderId,
  params,
  onSuccess,
  onFail
) {
  var allFiles = [];
  switch (sourceId) {
    case "gdrive":
      gdrive.listFiles(
        uid,
        folderId,
        params,
        ({ data }) => {
          data.files.forEach(file => {
            allFiles.push({ source: "gdrive", dat: file });
          });
          onSuccess(allFiles);
        },
        onFail
      );
      break;

    case "onedrive":
      onedrive.listFiles(
        uid,
        folderId,
        params,
        data => {
          data.value.forEach(file => {
            allFiles.push({ source: "onedrive", dat: file });
          });
          onSuccess(allFiles);
        },
        onFail
      );
      break;

    default:
      onFail({
        errors: [
          { code: 400, message: "Sourceid (" + sourceId + ") is invalid" }
        ]
      });
      return;
  }
};

exports.getFileMetadata = function(
  uid,
  sourceId,
  fileId,
  keys,
  onSuccess,
  onFail
) {
  switch (sourceId) {
    case "gdrive":
      gdrive.getFileMetadata(
        uid,
        fileId,
        keys,
        ({ data }) => {
          onSuccess(data);
        },
        onFail
      );
      break;
    case "onedrive":
      onedrive.getFileMetadata(uid, fileId, keys, onSuccess, onFail);
      break;

    default:
      onFail({
        errors: [
          { code: 400, message: "Sourceid (" + sourceId + ") is invalid" }
        ]
      });
      return;
  }
};

exports.updateFileMetadata = function(
  uid,
  fileId,
  metadata,
  onSuccess,
  onFail
) {
  gdrive.updateFileMetadata(uid, fileId, metadata, onSuccess, onFail);
};

exports.search = function(uid, sourceId, query, params, onSuccess, onFail) {
  var allFiles = [];
  switch (sourceId) {
    case "gdrive":
      delete params.orderBy;
      gdrive.listFiles(
        uid,
        "root",
        Object.assign(params, { q: "fullText contains '" + query + "'" }),
        ({ data }) => {
          data.files.forEach(file => {
            allFiles.push({ source: "gdrive", dat: file });
          });
          onSuccess(allFiles);
        },
        onFail
      );
      break;

    case "onedrive":
      onedrive.search(
        uid,
        query,
        params,
        data => {
          data.value.forEach(file => {
            allFiles.push({ source: "onedrive", dat: file });
          });
          onSuccess(allFiles);
        },
        onFail
      );
      break;

    default:
      onFail({
        errors: [
          { code: 400, message: "Sourceid (" + sourceId + ") is invalid" }
        ]
      });
      return;
  }
};
