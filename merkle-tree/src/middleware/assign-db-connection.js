import config from 'config';
import adminDbConnection from '../db/common/adminDbConnection';
import DB from '../db/mongodb/db';

const { admin } = config.get('mongo');

export default async function(req, res, next) {
  // console.log('\nsrc/middleware/assign-db-connection');
  // console.log('req.path:', req.path);
  // console.log('req.method:', req.method);
  // console.log('req.headers:', req.headers);

  req.user = {};

  try {
    // if the request is to initialise a new db connection, then return.
    if (req.path === '/db-connection' && req.method === 'POST') {
      return next();
    }

    // otherwise, give all requesters admin privileges:
    // console.log('\nAssigning req.user.connection as', adminDbConnection);
    req.user.connection = adminDbConnection;

    req.user.db = new DB(req.user.connection, admin);

    return next();
  } catch (err) {
    console.log(err);
    return next(err);
  }
}
