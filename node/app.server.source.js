Source = require("../model/app.model.source");
const gdrive = require("./app.server.source.gdrive");
const onedrive = require("./app.server.source.onedrive");

const udb = require("./app.server.user");

var sources = [
  new Source("gdrive", "Google Drive"),
  new Source("onedrive", "Onedrive"),
  new Source("onedrive365", "Office 365")
];

exports.sources = sources;

exports.getSource = function(sourceid) {
  var source = null;
  sources.forEach(asource => {
    if (asource.id == sourceid) {
      source = source;
    }
  });
  return source;
};

gdrive.init();
onedrive.init();

exports.beginConnect = function(sourceid, uid, onPrompt, onSuccess, onFail) {
  switch (sourceid) {
    case "gdrive":
      gdrive.beginAuthorize(uid, onPrompt, onSuccess);
      break;
    case "onedrive":
      onedrive.beginAuthorize(uid, onPrompt, onSuccess, onFail);
      break;

    default:
      return 400;
  }
  return 100;
};

exports.finishConnect = function(sourceid, uid, code, onSuccess, onFail) {
  switch (sourceid) {
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

exports.listFiles = function(uid, sourceId, folderId, onSuccess, onFail) {
  var allFiles = [];
  switch (sourceId) {
    case "gdrive":
      gdrive.listFiles(
        uid,
        folderId,
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

exports.extendGDriveScope = function(uid, onComplete) {
  gdrive.extendScope(uid, onComplete);
};

exports.getFileMetadata = function(uid, fileId, keys, onSuccess, onFail) {
  gdrive.getFileMetadata(uid, fileId, keys, onSuccess, onFail);
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
