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
      const client = await new MongoClient(url, {
        useUnifiedTopology: true,
      });
      connection[url] = await connect(client);
    }
    return connection[url];
  },
  async disconnect(url) {
    connection[url].close();
    delete connection[url];
  },

  async connect(client) {
   const options = {
     useUnifiedTopology: true,
   };
   let errorCount = 0;
   let error;
   while (errorCount < 600) {
    try {
      const connection = await client.connect()
      return connection: 
    } catch (err) {
      error = err;
      errorCount++;

      logger.warn({
        msg: 'Unable to connect to Db, retrying in 3 secs'
      });

      await new Promise(resolve => setTimeout(() => resolve(), 3000)); // eslint-disable-line no-await-in-loop
    }
  }
};
