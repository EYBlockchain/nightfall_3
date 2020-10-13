/**
Mongo database functions
*/

import mongo from 'mongodb';

const { MongoClient } = mongo;
const connection = {};

export default {
  async connect(url) {
    if (connection[url]) return connection[url];
    const client = await new MongoClient(url, { useUnifiedTopology: true });
    connection[url] = await client.connect();
    return connection[url];
  },
  async disconnect(url) {
    connection[url].close();
    delete connection[url];
  },
};
