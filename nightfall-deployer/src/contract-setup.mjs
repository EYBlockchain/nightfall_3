/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';

async function setupContracts() {
  const web3 = Web3.connection();

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

  const simpleMultiSigAddress = (await waitForContract('SimpleMultiSig')).options.address;

  const contracts = {
    proposers,
    shield,
    challenges,
  };

  for await (const contractName of ['proposers', 'shield', 'challenges']) {
    console.log(contractName);

    const setStateContract = contracts[contractName].methods.setStateContract(
      stateInstance.options.address,
    );

    const transferOwnership =
      contracts[contractName].methods.transferOwnership(simpleMultiSigAddress);

    if (!config.ETH_PRIVATE_KEY) {
      setStateContract.send();
      transferOwnership.send();
    } else {
      tx.data = setStateContract.encodeABI();
      let signed = await web3.eth.accounts.signTransaction(
        { ...tx, to: contracts[contractName].options.address },
        config.ETH_PRIVATE_KEY,
      );
      await web3.eth.sendSignedTransaction(signed.rawTransaction);

      tx.data = transferOwnership.encodeABI();
      signed = await web3.eth.accounts.signTransaction(
        { ...tx, to: contracts[contractName].options.address },
        config.ETH_PRIVATE_KEY,
      );
      await web3.eth.sendSignedTransaction(signed.rawTransaction);
    }
  }
  Web3.disconnect();
}

export default setupContracts;
