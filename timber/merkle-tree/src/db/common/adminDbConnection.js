import mongoose from 'mongoose';
import config from 'config';

const { host, port, databaseName } = config.get('mongo');
const dbConnections = {};

dbConnections.admin = mongoose.createConnection(`mongodb://${host}:${port}/${databaseName}`, {
  useNewUrlParser: true,
  useCreateIndex: true,
});

const adminDbConnection = dbConnections.admin;

export default adminDbConnection;
