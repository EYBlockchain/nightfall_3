import request from 'request';
import config from 'config';
import Web3 from '../../src/web3';
import utilsWeb3 from '../../src/utils-web3';

const web3 = Web3.connect();

/**
Gets the address of a deployed MerkleTree.sol contract
*/
async function getContractAddress(contractName) {
  console.log(`\nCalling getContractAddress(${contractName})`);
  const url = `${config.merkleTree.host}:${config.merkleTree.port}`;
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/metadata/contractAddress`,
      method: 'GET',
      json: true,
      headers: { contractname: contractName },
      body: { contractName },
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body.data);
    });
  });
}

/**
Gets MerkleTree.sol contract data
*/
async function getContractInstance(contractName) {
  try {
    console.log(`\nCalling getContractInstance(${contractName})`);
    const { contractAddress } = await getContractAddress(contractName);
    console.log('contractAddress:', contractAddress);
    const contractInterface = utilsWeb3.getContractInterface(contractName);
    // console.log('contractInterface:', contractInterface);
    const { abi } = contractInterface;
    // console.log('abi', abi);

    const contractInstance = await new web3.eth.Contract(abi, contractAddress);

    // console.log('\nMerkleTree.sol contract instance:\n', contractInstance);
    if (typeof contractInstance === 'undefined')
      throw new Error('Could not retrieve contractInstance');

    return contractInstance;
  } catch (err) {
    throw new Error(err);
  }
}

export default {
  getContractInstance,
};
