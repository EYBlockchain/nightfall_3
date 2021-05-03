/**
 * @module node.routes.js
 * @author iAmMichaelConnor
 * @desc gateway for querying contract details from some external contract deployment microservice.
 */

import request from 'request';
import config from 'config';
import Web3 from '../web3';
import logger from '../logger';

const web3 = Web3.connect();

/**
Gets an instance of a MerkleTree.sol contract interface from some external contract deployment microservice, a.k.a. 'deployer'
*/
async function getContractInterface(contractName) {
  logger.debug(`Calling getContractInterface(${contractName})`);
  const url = `${config.deployer.host}:${config.deployer.port}`;
  logger.debug(`url:, ${url}`);
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
  logger.debug(`Calling getContractAddress(${contractName})`);
  const url = `${config.deployer.host}:${config.deployer.port}`;
  logger.debug(`url: ${url}`);
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
    logger.debug(`Calling getContractInstance(${contractName})`);
    const { contractAddress } = await getContractAddress(contractName);
    logger.silly(`contractAddress, ${contractAddress}`);
    const { contractInterface } = await getContractInterface(contractName);
    logger.silly(`contractInterface ${JSON.stringify(contractInterface)}`);
    const { abi } = contractInterface;
    logger.silly(`abi, ${JSON.stringify(abi, null, 2)}`);

    const contractInstance = await new web3.eth.Contract(abi, contractAddress);

    logger.silly(`MerkleTree.sol contract instance: ${JSON.stringify(contractInstance, null, 2)}`);
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
