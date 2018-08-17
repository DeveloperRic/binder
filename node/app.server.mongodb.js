const MongoClient = require("mongodb").MongoClient;
const assert = require("assert");

const url = "mongodb://admin:78nZsaOaA24d@ds121382.mlab.com:21382/binder";
const dbName = "binder";

var mongodb;

exports.connect = function() {
  // open the connection to the binder MongoDB server
  MongoClient.connect(
    url,
    {
      useNewUrlParser: true
    },
    function(err, client) {
      assert.equal(null, err);
      // create a new database instance
      mongodb = client.db(dbName);
      console.log("Successfully connected to MongoDB server");
    }
  );
};

exports.insertDocument = function(collectionName, document, onSuccess, onFail) {
  mongodb.collection(collectionName).insertOne(document, function(err, result) {
    if (err || result.insertedCount != 1) {
      console.error(err);
      return onFail(err, result);
    }
    onSuccess(result);
  });
};

exports.findDocuments = function(collectionName, query, onSuccess, onFail) {
  mongodb
    .collection(collectionName)
    .find(query)
    .toArray(function(err, docs) {
      if (err) {
        console.error(err);
        return onFail(err);
      }
      onSuccess(docs);
    });
};

exports.updateDocumentField = function(
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
    .updateOne(query, operation, function(err, result) {
      if (err) {
        console.error(err);
        return onFail(err, result);
      }
      onSuccess(result);
    });
}
exports.updateDocument = updateDocument;

exports.upsertDocument = function(
  collectionName,
  query,
  $set,
  onSuccess,
  onFail
) {
  mongodb
    .collection(collectionName)
    .updateOne(
      query,
      // { $set: $set, $setOnInsert: $setOnInsert }
      { $set: $set },
      { upsert: true },
      function(err, result) {
        if (err) {
          console.error(err);
          return onFail(err, result);
        }
        onSuccess(result);
      }
    );
};

exports.removeDocument = function(collectionName, query, onSuccess, onFail) {
  mongodb.collection(collectionName).deleteOne(query, function(err, result) {
    if (err) {
      console.error(err);
      return onFail(err, result);
    }
    onSuccess(result);
  });
};
