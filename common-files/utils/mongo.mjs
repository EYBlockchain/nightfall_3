/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
Mongo database functions
*/

import mongo from 'mongodb';
import logger from './logger.mjs';

const { MongoClient } = mongo;
const connection = {};

export default {
  async connection(url) {
    if (connection[url]) return connection[url];
    // Check if we are connecting to MongoDb or DocumentDb
    if (url.includes('amazonaws')) {
      // retrieve user and password from secrets
      const { MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_ROOT_USERNAME, MONGO_CA } = process.env;
      logger.debug(`Received AWS url ${url}`);
      logger.debug(
        `username ${MONGO_INITDB_ROOT_USERNAME}, password ${MONGO_INITDB_ROOT_PASSWORD}`,
      );
      const client = await new MongoClient(
        `mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${url}:27017/?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`,
        {
          tlsCAFile: `${MONGO_CA}`, // Specify the DocDB; cert
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
