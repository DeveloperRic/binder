Source = require("../model/app.model.source");
const gdrive = require("./app.server.source.gdrive");

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

exports.beginConnect = function(sourceid, uid, onPrompt, onSuccess) {
  switch (sourceid) {
    case "gdrive":
      beginConnectGDrive(uid, onPrompt, onSuccess);
      break;

    default:
      return 400;
  }
  return 100;
};

var beginConnectGDrive = function(uid, onPrompt, onSuccess) {
  gdrive.beginAuthorize(uid, onPrompt, onSuccess);
};

exports.finishConnect = function(sourceid, uid, code, onSuccess, onFail) {
  switch (sourceid) {
    case "gdrive":
      finishConnectGDrive(uid, code, onSuccess, onFail);
      break;

    default:
      return 400;
  }
  return 100;
};

var finishConnectGDrive = function(uid, code, onSuccess, onFail) {
  gdrive.finishAuthorize(uid, code, onSuccess, onFail);
};

exports.listFiles = function(uid, folderId, onSuccess, onFail) {
  gdrive.listFiles(uid, folderId, onSuccess, onFail);
};

exports.extendGDriveScope = function(uid, onComplete) {
  gdrive.extendScope(uid, onComplete);
};

exports.getFileMetadata = function(uid, fileId, keys, onSuccess, onFail) {
  gdrive.getFileMetadata(uid, fileId, keys, onSuccess, onFail);
};

exports.updateFileMetadata = function(uid, fileId, metadata, onSuccess, onFail) {
  gdrive.updateFileMetadata(uid, fileId, metadata, onSuccess, onFail);
};
