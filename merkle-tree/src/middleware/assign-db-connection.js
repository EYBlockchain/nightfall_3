import config from 'config';
import adminDbConnection from '../db/common/adminDbConnection';
import DB from '../db/mongodb/db';
import logger from '../logger';

const { admin } = config.get('mongo');

export default async function(req, res, next) {
  logger.debug('src/middleware/assign-db-connection');
  logger.silly(
    `req.query: ${JSON.stringify(req.query, null, 2)}, req.body: ${JSON.stringify(
      req.body,
      null,
      2,
    )}`,
  );

  try {
    let contractName = req.body.contractName || req.query.contractName;
    if (contractName === undefined) {
      const contractNameTest = req.body[0].contractName;
      if (contractNameTest === undefined) {
        throw new Error('No contractName key provided in req.body.');
      } else {
        contractName = contractNameTest;
      }
    }
    const treeId = req.body.treeId || req.query.treeId;
    logger.silly(`treeId: ${treeId}`);
    req.user = {};
    // give all requesters admin privileges:
    req.user.connection = adminDbConnection;

    req.user.db = new DB(req.user.connection, admin, contractName, treeId);

    return next();
  } catch (err) {
    logger.error(err);
    return next(err);
  }
}
