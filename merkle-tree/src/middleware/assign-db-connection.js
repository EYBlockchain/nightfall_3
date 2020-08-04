import config from 'config';
import adminDbConnection from '../db/common/adminDbConnection';
import DB from '../db/mongodb/db';

const { admin } = config.get('mongo');

export default async function(req, res, next) {
  console.log('\nsrc/middleware/assign-db-connection');
  // console.log('req.body:', req.body);

  try {
    let contractName = req.body.contractName;
    if (contractName === 'MerkleTreeControllerMiMC') {
      contractName =
        process.env.CURVE === 'BLS12_377'
          ? 'MerkleTreeControllerMiMC_BLS12'
          : 'MerkleTreeControllerMiMC_BN254';
    } else if (contractName === undefined) {
      const contractNameTest = req.body[0].contractName;
      if (contractNameTest === undefined) {
        throw new Error('No contractName key provided in req.body.');
      } else {
        contractName = contractNameTest;
      }
    }
    const treeId = req.body.treeId;
    // console.log(`treeId: ${treeId}`);
    req.user = {};
    // give all requesters admin privileges:
    // console.log('\nAssigning req.user.connection as', adminDbConnection);
    req.user.connection = adminDbConnection;

    req.user.db = new DB(req.user.connection, admin, contractName, treeId);

    return next();
  } catch (err) {
    console.log(err);
    return next(err);
  }
}
