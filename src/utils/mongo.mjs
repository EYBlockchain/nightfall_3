/**
Mongo database functions
*/

import mongo from 'mongodb';

const { MongoClient } = mongo;
const db = {};

export default {
  connection: {},
  async connect(url, name) {
    if (db[name]) return db[name];
    const client = await new MongoClient(url, { useUnifiedTopology: true });
    this.connection = await client.connect();
    db[name] = this.connection.db(name);
    return db[name];
  },
  async disconnect() {
    this.connection.close();
  },
};
