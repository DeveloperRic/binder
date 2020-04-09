const MongoClient = require("mongodb").MongoClient;
require("dotenv").config();

/**
 * @type {MongoClient.Db}
 */
var mongodb;

function connect() {
  // open the connection to the binder MongoDB server
  return new Promise((resolve, reject) => {
    MongoClient.connect(
      process.env.MONGODB_CONNECTION_STRING,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
      (err, client) => {
        if (err) return reject(err);
        // create a new database instance
        mongodb = client.db(process.env.MONGODB_DATABASE_NAME);
        console.log("Successfully connected to MongoDB server");
        resolve();
      }
    );
  });
}

function insertDocument(collectionName, document) {
  return new Promise((resolve, reject) => {
    mongodb.collection(collectionName).insertOne(document, (err, result) => {
      if (err || result.insertedCount != 1) {
        console.error(err);
        return reject(err); // (err, result)
      }
      resolve(result);
    });
  });
}

function findDocuments(collectionName, query) {
  return new Promise((resolve, reject) => {
    mongodb
      .collection(collectionName)
      .find(query)
      .toArray((err, docs) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        resolve(docs);
      });
  });
}

function updateDocumentField(collectionName, query, $set) {
  return updateDocument(collectionName, query, { $set: $set });
}

function updateDocument(collectionName, query, operation) {
  return new Promise((resolve, reject) => {
    mongodb
      .collection(collectionName)
      .updateOne(query, operation, (err, result) => {
        if (err) {
          console.error(err);
          return reject(err, result);
        }
        resolve(result);
      });
  });
}

function upsertDocument(collectionName, query, $set) {
  return new Promise((resolve, reject) => {
    mongodb.collection(collectionName).updateOne(
      query,
      // { $set: $set, $setOnInsert: $setOnInsert }
      { $set: $set },
      { upsert: true },
      (err, result) => {
        if (err) {
          console.error(err);
          return reject(err); // (err, result)
        }
        resolve(result);
      }
    );
  });
}

function removeDocument(collectionName, query) {
  return new Promise((resolve, reject) => {
    mongodb.collection(collectionName).deleteOne(query, (err, result) => {
      if (err) {
        console.error(err);
        return reject(err, result); // (err, result)
      }
      resolve(result);
    });
  });
}

module.exports = {
  connect,
  insertDocument,
  findDocuments,
  updateDocumentField,
  updateDocument,
  upsertDocument,
  removeDocument,
};
