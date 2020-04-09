const gdrive = require("./gdrive");
const onedrive = require("./onedrive");
const dropbox = require("./dropbox");
const sources = require("./sources");

/**
 * @param {string} sourceId
 * @returns {Source}
 */
function getSource(sourceId) {
  for (const i in sources) {
    if (sources[i].id == sourceId) return sources[i];
  }
  return null;
}

/**
 * @returns {Promise<"authUrl">}
 */
function beginConnect(sourceId, uid, forceUpdate) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive.beginAuthorize(uid, forceUpdate);
        break;
      case "onedrive":
        promise = onedrive.beginAuthorize(uid, forceUpdate);
        break;
      case "onedrive365":
        return reject(501);
      case "dropbox":
        promise = dropbox.beginAuthorize(uid, forceUpdate);
        break;
      default:
        return reject(400);
    }
    promise.then(resolve).catch(reject);
  });
}

function finishConnect(sourceId, uid, code) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive.finishAuthorize(uid, code);
        break;
      case "onedrive":
        promise = onedrive.finishAuthorize(uid, code);
        break;
      case "dropbox":
        promise = dropbox.finishAuthorize(uid, code);
        break;

      default:
        return reject(400);
    }
    promise.then(resolve).catch(reject);
  });
}

function disconnect(sourceId, uid) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive.unAuthorize(uid);
        break;
      case "onedrive":
        promise = onedrive.unAuthorize(uid);
        break;
      case "dropbox":
        promise = dropbox.unAuthorize(uid);
        break;

      default:
        return reject(400);
    }
    promise.then(resolve).catch(reject);
  });
}

/**
 * This function is fail-fast.
 * Will reject as soon as any source fails to update access levels
 */
function updateAccessLevels(uid) {
  return new Promise((resolve, reject) => {
    Promise.all([
      gdrive.resetUserToken(uid),
      onedrive.resetUserToken(uid),
      dropbox.resetUserToken(uid),
    ])
      .then(resolve)
      .catch(reject);
  });
}

function listFiles(uid, sourceId, folderId, pageToken, params) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive
          .listFiles(uid, folderId, pageToken, params)
          .then(({ data }) =>
            resolve([
              data.files.reduce((acc, curFile) => {
                acc.push({ source: "gdrive", dat: curFile });
                return acc;
              }, []),
              data.nextPageToken,
            ])
          );
        break;

      case "onedrive":
        promise = onedrive
          .listFiles(uid, folderId, pageToken, params)
          .then(data =>
            resolve([
              data.value.reduce((acc, curFile) => {
                acc.push({ source: "onedrive", dat: curFile });
                return acc;
              }, []),
              data["@odata.nextLink"],
            ])
          );
        break;

      case "dropbox":
        promise = dropbox.listFiles(uid, folderId, pageToken).then(data =>
          resolve([
            data.entries.reduce((acc, curFile) => {
              acc.push({ source: "dropbox", dat: curFile });
              return acc;
            }, []),
            data.has_more ? data.cursor : null,
          ])
        );
        break;

      default:
        return failParser(
          400,
          "Sourceid (" + sourceId + ") is invalid",
          reject
        );
    }
    promise.catch(reject);
  });
}

function getFileMetadata(uid, sourceId, fileId, keys) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive
          .getFileMetadata(uid, fileId, keys)
          .then(({ data }) => resolve(data));
        break;
      case "onedrive":
        promise = onedrive.getFileMetadata(uid, fileId, keys).then(resolve);
        break;

      default:
        return failParser(
          400,
          "Sourceid (" + sourceId + ") is invalid",
          reject
        );
    }
    promise.catch(reject);
  });
}

function updateFileMetadata(uid, sourceId, fileId, metadata) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        promise = gdrive
          .updateFileMetadata(uid, fileId, metadata)
          .then(({ data }) => resolve(data));
        break;
      case "onedrive":
        promise = onedrive
          .updateFileMetadata(uid, fileId, metadata)
          .then(resolve);
        break;
      case "dropbox":
        promise = dropbox
          .updateFileMetadata(uid, fileId, metadata)
          .then(({ metadata }) => resolve(metadata));
        break;

      default:
        return failParser(
          400,
          "Sourceid (" + sourceId + ") is invalid",
          reject
        );
    }
    promise.catch(reject);
  });
}

function search(uid, sourceId, query, pageToken, params) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "gdrive":
        delete params.orderBy;
        promise = gdrive
          .listFiles(
            uid,
            "root",
            pageToken,
            Object.assign(params, { q: "fullText contains '" + query + "'" })
          )
          .then(({ data }) =>
            resolve([
              data.files.reduce((acc, curFile) => {
                acc.push({ source: "gdrive", dat: curFile });
                return acc;
              }, []),
              data.nextPageToken,
            ])
          );
        break;

      case "onedrive":
        promise = onedrive.search(uid, query, pageToken, params).then(data =>
          resolve([
            data.value.reduce((acc, curFile) => {
              acc.push({ source: "onedrive", dat: curFile });
              return acc;
            }, []),
            data["@odata.nextLink"],
          ])
        );
        break;

      case "dropbox":
        promise = dropbox.search(uid, query, pageToken).then(data =>
          resolve([
            data.matches.reduce((acc, match) => {
              acc.push({ source: "dropbox", dat: match.metadata });
              return acc;
            }, []),
            data.more ? data.start : null,
          ])
        );
        break;

      default:
        return reject({
          errors: [
            { code: 400, message: "Sourceid (" + sourceId + ") is invalid" },
          ],
        });
    }
    promise.catch(reject);
  });
}

function getFileContent(uid, sourceId, fileId) {
  return new Promise((resolve, reject) => {
    let promise;
    switch (sourceId) {
      case "onedrive":
        promise = onedrive.getFileContent(uid, fileId);
        break;

      case "dropbox":
        promise = dropbox.getContentLink(uid, fileId);
        break;

      default:
        return failParser(
          400,
          "Sourceid (" + sourceId + ") is invalid",
          reject
        );
    }
    promise.then(resolve).catch(reject);
  });
}

function failParser(statusCode, message, failHandler) {
  return failHandler({
    errors: [
      {
        code: statusCode,
        message: message,
      },
    ],
  });
}

module.exports = {
  sources,
  getSource,
  beginConnect,
  finishConnect,
  disconnect,
  updateAccessLevels,
  listFiles,
  getFileMetadata,
  updateFileMetadata,
  search,
  getFileContent,
};
