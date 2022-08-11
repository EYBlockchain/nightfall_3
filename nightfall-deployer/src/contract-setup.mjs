/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';

export const web3 = Web3.connection();

async function setupContracts() {
  const stateInstance = await waitForContract('State');
  console.log(`address of State contract is ${stateInstance.options.address}`);

  const tx = {
    from: process.env.FROM_ADDRESS,
    // value: fee,
    gas: config.WEB3_OPTIONS.gas,
    gasPrice: 20000000000,
  };

  const proposers = await waitForContract('Proposers');
  const shield = await waitForContract('Shield');
  const challenges = await waitForContract('Challenges');
  const state = await waitForContract('State');

  // when deploying on infura
  // do serial registration to predict nonce
  // or, if we have the owner's private key, sign with that, rather than use an unlocked account
  let data;
  let signed;
  if (config.ETH_PRIVATE_KEY) {
    data = proposers.methods.setStateContract(stateInstance.options.address).encodeABI();
    tx.data = data;
    signed = await web3.eth.accounts.signTransaction(
      { ...tx, to: proposers.options.address },
      config.ETH_PRIVATE_KEY,
    );
    await web3.eth.sendSignedTransaction(signed.rawTransaction);

    data = shield.methods.setStateContract(stateInstance.options.address).encodeABI();
    tx.data = data;
    signed = await web3.eth.accounts.signTransaction(
      { ...tx, to: shield.options.address },
      config.ETH_PRIVATE_KEY,
    );
    await web3.eth.sendSignedTransaction(signed.rawTransaction);

    data = challenges.methods.setStateContract(stateInstance.options.address).encodeABI();
    tx.data = data;
    signed = await web3.eth.accounts.signTransaction(
      { ...tx, to: challenges.options.address },
      config.ETH_PRIVATE_KEY,
    );
    await web3.eth.sendSignedTransaction(signed.rawTransaction);
  }

  // our last action as the deployer is to hand off our onlyOwner powers to the
  // multisig contract
  const simpleMultiSigAddress = (await waitForContract('SimpleMultiSig')).options.address;

  data = shield.methods.transferOwnership(simpleMultiSigAddress).encodeABI();
  tx.data = data;
  signed = await web3.eth.accounts.signTransaction(
    { ...tx, to: shield.options.address },
    config.ETH_PRIVATE_KEY,
  );

  data = state.methods.transferOwnership(simpleMultiSigAddress).encodeABI();
  tx.data = data;
  signed = await web3.eth.accounts.signTransaction(
    { ...tx, to: state.options.address },
    config.ETH_PRIVATE_KEY,
  );

  data = proposers.methods.transferOwnership(simpleMultiSigAddress).encodeABI();
  tx.data = data;
  signed = await web3.eth.accounts.signTransaction(
    { ...tx, to: proposers.options.address },
    config.ETH_PRIVATE_KEY,
  );

  data = challenges.methods.transferOwnership(simpleMultiSigAddress).encodeABI();
  tx.data = data;
  signed = await web3.eth.accounts.signTransaction(
    { ...tx, to: challenges.options.address },
    config.ETH_PRIVATE_KEY,
  );
}

export default setupContracts;
