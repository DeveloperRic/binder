const MongoClient = require("mongodb").MongoClient;
require("dotenv").config();

var mongodb;

exports.connect = function (onSuccess, onFail) {
  // open the connection to the binder MongoDB server
  MongoClient.connect(
    process.env.MONGODB_CONNECTION_STRING,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
    (err, client) => {
      if (err) return onFail(err);
      // create a new database instance
      mongodb = client.db(process.env.MONGODB_DATABASE_NAME);
      console.log("Successfully connected to MongoDB server");
      onSuccess();
    }
  );
};

exports.insertDocument = function (
  collectionName,
  document,
  onSuccess,
  onFail
) {
  mongodb
    .collection(collectionName)
    .insertOne(document, function (err, result) {
      if (err || result.insertedCount != 1) {
        console.error(err);
        return onFail(err, result);
      }
      onSuccess(result);
    });
};

exports.findDocuments = function (collectionName, query, onSuccess, onFail) {
  mongodb
    .collection(collectionName)
    .find(query)
    .toArray(function (err, docs) {
      if (err) {
        console.error(err);
        return onFail(err);
      }
      onSuccess(docs);
    });
};

exports.updateDocumentField = function (
  collectionName,
  query,
  $set,
  onSuccess,
  onFail
) {
  updateDocument(collectionName, query, { $set: $set }, onSuccess, onFail);
};

function updateDocument(collectionName, query, operation, onSuccess, onFail) {
  mongodb
    .collection(collectionName)
    .updateOne(query, operation, function (err, result) {
      if (err) {
        console.error(err);
        return onFail(err, result);
      }
      onSuccess(result);
    });
}
exports.updateDocument = updateDocument;

exports.upsertDocument = function (
  collectionName,
  query,
  $set,
  onSuccess,
  onFail
) {
  mongodb.collection(collectionName).updateOne(
    query,
    // { $set: $set, $setOnInsert: $setOnInsert }
    { $set: $set },
    { upsert: true },
    function (err, result) {
      if (err) {
        console.error(err);
        return onFail(err, result);
      }
      onSuccess(result);
    }
  );
};

exports.removeDocument = function (collectionName, query, onSuccess, onFail) {
  mongodb.collection(collectionName).deleteOne(query, function (err, result) {
    if (err) {
      console.error(err);
      return onFail(err, result);
    }
    onSuccess(result);
  });
};
