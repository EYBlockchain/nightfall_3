/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
Mongo database functions
*/

import mongo from 'mongodb';

const { MongoClient } = mongo;
const connection = {};

export default {
  async connection(url) {
    if (connection[url]) return connection[url];
    // Check if we are connecting to MongoDb or DocumentDb
    const { MONGO_CONNECTION_STRING = '' } = process.env;
    if (MONGO_CONNECTION_STRING !== '') {
      const client = await new MongoClient(`${MONGO_CONNECTION_STRING}`, {
        useUnifiedTopology: true,
      });
      connection[url] = await client.connect();
    } else {
      const options = {
        serverSelectionTimeoutMS: 10000,
        useUnifiedTopology: true,
      };
      const client = await new MongoClient(url, options);
      connection[url] = await client.connect();
    }
    return connection[url];
  },
  async disconnect(url) {
    connection[url].close();
    delete connection[url];
  },
};
