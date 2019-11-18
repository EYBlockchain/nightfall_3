import config from 'config';
import adminDbConnection from '../db/common/adminDbConnection';
import DB from '../db/mongodb/db';

const { admin } = config.get('mongo');

export default async function(req, res, next) {
  console.log('\nsrc/middleware/assign-db-connection');
  // console.log('req.headers:', req.headers);

  try {
    const contractName = req.headers.contractname;
    if (contractName === undefined) throw new Error('No contractname key provided in req.headers.');

    req.user = {};
    // give all requesters admin privileges:
    // console.log('\nAssigning req.user.connection as', adminDbConnection);
    req.user.connection = adminDbConnection;

    req.user.db = new DB(req.user.connection, admin, contractName);

    return next();
  } catch (err) {
    console.log(err);
    return next(err);
  }
}
