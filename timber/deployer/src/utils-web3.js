/**
@module utils-web3.js
@author MichaelConnorOfficial
@desc Set of utilities to make web3 methods easier to use
*/

// First we need to connect to a websocket provider.
// Important Note: Subscribe method only works with a websocket provider!

import Web3 from './web3';

const web3 = Web3.connect();

function getContractInterface(contractName) {
  const path = `../build/contracts/${contractName}.json`;
  const contractInterface = require(path); // eslint-disable-line global-require, import/no-dynamic-require
  // console.log("\ncontractInterface:")
  // console.log(contractInterface)
  return contractInterface;
}

// returns a web3 contract instance (rather than a truffle-contract instance)
function getContractInstance(contractName, deployedAddress) {
  const contractInterface = getContractInterface(contractName);
  let contractInstance;

  if (!deployedAddress) {
    contractInstance = new web3.eth.Contract(contractInterface.abi);
  } else {
    contractInstance = new web3.eth.Contract(contractInterface.abi, deployedAddress);
  }
  // console.log("\ncontractInstance:")
  // console.log(contractInstance)
  return contractInstance;
}

// returns a web3 contract instance (rather than a truffle-contract instance)
function getContractBytecode(contractName) {
  const contractInterface = getContractInterface(contractName);
  const { bytecode } = contractInterface;
  // console.log('\nbytecode:');
  // console.log(bytecode);
  return bytecode;
}

export default {
  getContractInterface,
  getContractInstance,
  getContractBytecode,
};
