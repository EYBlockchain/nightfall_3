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
    if (url.includes('amazonaws')) {
      // retrieve user and password from secrets
      const { MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_ROOT_USERNAME} = process.env;
      const client = await new MongoClient(
        `mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${url}:27017/?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`,
        {
          useUnifiedTopology: true,
        },
      );
      connection[url] = await client.connect();
    } else {
      const client = await new MongoClient(url, { useUnifiedTopology: true });
      connection[url] = await client.connect();
    }
    return connection[url];
  },
  async disconnect(url) {
    connection[url].close();
    delete connection[url];
  },
};
