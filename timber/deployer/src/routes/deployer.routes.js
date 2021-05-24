/**
@module index.js
@desc REST api endpoints for the deployer
@author
*/

import db from '../leveldb';
import utilsWeb3 from '../utils-web3';

async function getContractAddress(req, res) {
  console.log('\nDeployer received a request for the deployed contract address\n');
  try {
    const { contractName } = req.body;
    const contractAddress = await db.get(contractName);
    res.json({ contractAddress });
  } catch (err) {
    console.error('\nError thrown:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getContractInterface(req, res) {
  console.log('\nDeployer received a request for the deployed contract interface\n');
  try {
    const { contractName } = req.body;
    const contractInterface = await utilsWeb3.getContractInterface(contractName);
    res.json({ contractInterface });
  } catch (err) {
    console.error('\nError thrown:', err);
    res.status(500).json({ error: err.message });
  }
}

export default router => {
  router.route('/contract/address').get(getContractAddress);
  router.route('/contract/interface').get(getContractInterface);
};
