Source = require("../model/app.model.source");
const gdrive = require("./app.server.source.gdrive");
const onedrive = require("./app.server.source.onedrive");
const dropbox = require("./app.server.source.dropbox");

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
dropbox.init();

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
    case "dropbox":
      dropbox.beginAuthorize(uid, forceUpdate, onPrompt, onSuccess, onFail);
      break;

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
    case "dropbox":
      dropbox.finishAuthorize(uid, code, onSuccess, onFail);
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
    case "dropbox":
      dropbox.unAuthorize(uid, onSuccess, onFail);
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
    if (completedCount == 3) {
      onComplete(failedSources);
    }
  };
  gdrive.resetUserToken(uid, checkComplete, () => {
    failedSources.push("gdrive");
    checkComplete();
  });
  onedrive.resetUserToken(uid, checkComplete, () => {
    failedSources.push("onedrive");
    checkComplete();
  });
  dropbox.resetUserToken(uid, checkComplete, () => {
    failedSources.push("dropbox");
    checkComplete();
  });
};

exports.listFiles = function(
  uid,
  sourceId,
  folderId,
  pageToken,
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
        pageToken,
        params,
        ({ data }) => {
          data.files.forEach(file => {
            allFiles.push({ source: "gdrive", dat: file });
          });
          onSuccess(allFiles, data.nextPageToken);
        },
        onFail
      );
      break;

    case "onedrive":
      onedrive.listFiles(
        uid,
        folderId,
        pageToken,
        params,
        data => {
          data.value.forEach(file => {
            allFiles.push({ source: "onedrive", dat: file });
          });
          onSuccess(allFiles, data["@odata.nextLink"]);
        },
        onFail
      );
      break;

    case "dropbox":
      dropbox.listFiles(
        uid,
        folderId,
        pageToken,
        data => {
          data.entries.forEach(file => {
            allFiles.push({ source: "dropbox", dat: file });
          });
          onSuccess(allFiles, data.has_more ? data.cursor : null);
        },
        onFail
      );
      break;

    default:
      failParser(400, "Sourceid (" + sourceId + ") is invalid", onFail);
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
      failParser(400, "Sourceid (" + sourceId + ") is invalid", onFail);
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

exports.search = function(
  uid,
  sourceId,
  query,
  pageToken,
  params,
  onSuccess,
  onFail
) {
  var allFiles = [];
  switch (sourceId) {
    case "gdrive":
      delete params.orderBy;
      gdrive.listFiles(
        uid,
        "root",
        pageToken,
        Object.assign(params, { q: "fullText contains '" + query + "'" }),
        ({ data }) => {
          data.files.forEach(file => {
            allFiles.push({ source: "gdrive", dat: file });
          });
          onSuccess(allFiles, data.nextPageToken);
        },
        onFail
      );
      break;

    case "onedrive":
      onedrive.search(
        uid,
        query,
        pageToken,
        params,
        data => {
          data.value.forEach(file => {
            allFiles.push({ source: "onedrive", dat: file });
          });
          onSuccess(allFiles, data["@odata.nextLink"]);
        },
        onFail
      );
      break;

    case "dropbox":
      dropbox.search(
        uid,
        query,
        pageToken,
        data => {
          data.matches.forEach(match => {
            allFiles.push({ source: "dropbox", dat: match.metadata });
          });
          onSuccess(allFiles, data.more ? data.start : null);
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

exports.getFileContent = function(uid, sourceId, fileId, onSuccess, onFail) {
  switch (sourceId) {
    case "onedrive":
      onedrive.getFileContent(uid, fileId, onSuccess, onFail);
      break;

    case "dropbox":
      dropbox.getContentLink(uid, fileId, onSuccess, onFail);
      break;

    default:
      failParser(400, "Sourceid (" + sourceId + ") is invalid", onFail);
      return;
  }
};

function failParser(statusCode, message, failHandler) {
  return failHandler({
    errors: [
      {
        code: statusCode,
        message: message
      }
    ]
  });
}
