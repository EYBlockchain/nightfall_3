/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
Mongo database functions
*/

import mongo from 'mongodb';
import getAwsParameter from './aws-secrets.mjs';

const { MongoClient } = mongo;
const connection = {};

export default {
  async connection(url) {
    if (connection[url]) return connection[url];
    // Check if we are connecting to MongoDb or DocumentDb
    if (url.includes('amazonaws')) {
      // retrieve user and password from secrets
      const {
         ENVIRONMENT_NAME,
         MONGO_INITDB_ROOT_PASSWORD_PARAM,
         MONGO_INITDB_ROOT_USERNAME_PARAM,
         MONGO_CA,
      } = process.env;
      const mongoUser = await getAwsParameter(`/${ENVIRONMENT_NAME}/${MONGO_INITDB_ROOT_USERNAME_PARAM}`, false);
      const mongoPwd = await getAwsParameter(`/${ENVIRONMENT_NAME}/${MONGO_INITDB_ROOT_PASSWORD_PARAM}`, true);
      const client = await new MongoClient(
        `mongodb://${mongoUser}:${mongoPwd}@${url}:27017/?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`,
        {
          tlsCAFile: `${MONGO_CA}`, //Specify the DocDB; cert
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
