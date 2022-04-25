/* eslint import/no-extraneous-dependencies: "off" */
/**
utility to generate some ethereum private keys and addresses
*/
import Web3 from 'web3';
import rand from './crypto-random.mjs';

const web3 = new Web3();
async function printKeys() {
  const privateKeys = [];
  for (let i = 0; i < 10; i++) {
    privateKeys.push(rand(32));
  }
  const addressPromises = privateKeys.map(async pk =>
    web3.eth.accounts.privateKeyToAccount((await pk).hex(32), false),
  );
  const addresses = await Promise.all(addressPromises);
  addresses.map(a => console.log('Private Key', a.privateKey, 'Address', a.address));
}

printKeys();
