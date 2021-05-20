/**
 * @module node.service.js
 * @author iAmMichaelConnor
 * @desc deploy a contract using web3 directly
 */

import config from 'config';
import Web3 from './web3';
import utilsWeb3 from './utils-web3';
import db from './leveldb';

const web3 = Web3.connect();
const { options } = config.web3;

async function deploy(contractName) {
  const coinbase = await web3.eth.getCoinbase();
  console.log(`\nUnlocking account ${coinbase}...`);
  await web3.eth.personal.unlockAccount(coinbase, 'password', 1);

  let contractInstance = await utilsWeb3.getContractInstance(contractName); // get a web3 contract instance of the contract

  const bytecode = await utilsWeb3.getContractBytecode(contractName);

  await contractInstance
    .deploy({ data: bytecode }) // we would pass constructor arguments here
    .send({ from: coinbase, gas: options.defaultGas, gasPrice: options.defaultGasPrice })
    .on('error', err => {
      throw new Error(err);
    })
    .then(newContractInstance => {
      contractInstance = newContractInstance; // instance with the new contract address added
      console.log(`\n${contractName} contract deployed at address ${newContractInstance._address}`); // eslint-disable-line no-underscore-dangle
    });

  // store the address of the contract against its name
  console.log('\nAdding deployed contract address to db');
  await db.put(contractName, contractInstance._address); // eslint-disable-line no-underscore-dangle

  return contractInstance;
}

export default {
  deploy,
};
