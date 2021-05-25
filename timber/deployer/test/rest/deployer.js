import request from 'request';
import config from 'config';
import Web3 from '../../src/web3';

const web3 = Web3.connect();

/**
Gets an instance of a MerkleTree.sol contract interface from some external contract deployment microservice, a.k.a. 'deployer'
*/
async function getContractInterface(contractName) {
  console.log(`\nCalling getContractInterface(${contractName})`);
  const url = `${config.deployer.host}:${config.deployer.port}`;
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/contract/interface`,
      method: 'GET',
      json: true,
      body: { contractName },
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body);
    });
  });
}

/**
Gets the address of a deployed MerkleTree.sol contract from some external contract deployment microservice, a.k.a. 'deployer'
*/
async function getContractAddress(contractName) {
  console.log(`\nCalling getContractAddress(${contractName})`);
  const url = `${config.deployer.host}:${config.deployer.port}`;
  console.log('url:', url);
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/contract/address`,
      method: 'GET',
      json: true,
      body: { contractName },
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body);
    });
  });
}

/**
Gets MerkleTree.sol contract data from some external contract deployment microservice (a.k.a. 'deployer') and assembles a MerkleTree.sol contract instance
*/
async function getContractInstance(contractName) {
  try {
    console.log(`\nCalling *getContractInstance(${contractName})`);
    const { contractAddress } = await getContractAddress(contractName);
    console.log('contractAddress', contractAddress);
    const { contractInterface } = await getContractInterface(contractName);
    // console.log('contractInterface', contractInterface);
    const { abi } = contractInterface;
    console.log('abi', abi);

    const contractInstance = await new web3.eth.Contract(abi, contractAddress);

    console.log('\nMerkleTree.sol contract instance:\n', contractInstance);
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
