/* eslint-disable no-await-in-loop */
import { askQuestions } from './menu.mjs';
import { getTokenRestrictions } from '../services/contract-calls.mjs';
import {
  setTokenRestrictions,
  removeTokenRestrictions,
  pauseContracts,
  unpauseContracts,
  transferShieldBalance,
  transferOwnership,
  setBootProposer,
  setBootChallenger,
} from '../services/contract-transactions.mjs';
import { executeMultiSigTransaction } from '../services/helpers.mjs';
import { web3 } from '../../../common-files/utils/contract.mjs';

/**
UI control loop
*/
async function startLoop() {
  let exit = false;
  let ethereumSigningKey;
  let newEthereumSigningKey;
  let signed = false; // if we have enough signatures, the signed data is returned
  let executorAddress; // we need the address up front but the private key only at the end of the signing ceremony
  do {
    console.log('*!SIGNED', signed);
    const {
      task,
      privateKey,
      tokenName,
      depositRestriction,
      withdrawRestriction,
      pause,
      unpause,
      amount,
      newPrivateKey,
      executor,
      executorAddr,
    } = await askQuestions(ethereumSigningKey, signed);
    if (!privateKey && !ethereumSigningKey) {
      console.log('No private key was provided: exiting');
      return;
    }
    if (privateKey) ethereumSigningKey = `0x${privateKey.slice(2).padStart(64, '0')}`; // once we get a signing key remember it
    if (newPrivateKey) newEthereumSigningKey = `0x${newPrivateKey.slice(2).padStart(64, '0')}`;
    // the executor address is needed to properly create a multisig signature.
    if (executorAddr) {
      executorAddress = executorAddr;
      if (executorAddr === 'self')
        executorAddress = web3.eth.accounts.privateKeyToAccount(ethereumSigningKey).address;
    }
    if (signed) {
      console.log('Executing multisig transaction');
      await executeMultiSigTransaction(signed, executor);
      signed = false;
      // it's not possible to have a signature and a task so we can safely skip the rest of the loop
      continue; // eslint-disable-line no-continue
    }
    switch (task) {
      case 'Exit': {
        console.log('Exiting normally');
        exit = true;
        break;
      }
      case 'Get token restrictions': {
        console.log('Token restrictions are:');
        const [deposit, withdraw] = await getTokenRestrictions(tokenName);
        console.log('deposit:', deposit);
        console.log('withdraw:', withdraw);
        break;
      }
      case 'Set token restrictions': {
        signed = await setTokenRestrictions(
          tokenName,
          depositRestriction,
          withdrawRestriction,
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      case 'Remove token restrictions': {
        signed = await removeTokenRestrictions(tokenName, ethereumSigningKey, executorAddress);
        break;
      }
      case 'Unpause contracts': {
        if (!unpause) break;
        signed = await unpauseContracts(ethereumSigningKey, executorAddress);
        break;
      }
      case 'Pause contracts': {
        if (!pause) break;
        signed = await pauseContracts(ethereumSigningKey, executorAddress);
        break;
      }
      case 'Transfer Shield contract balance': {
        signed = await transferShieldBalance(
          tokenName,
          Number(amount),
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      case 'Transfer ownership': {
        signed = await transferOwnership(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
        );
        ethereumSigningKey = newEthereumSigningKey;
        break;
      }
      case 'Set new boot proposer': {
        signed = await setBootProposer(newEthereumSigningKey, ethereumSigningKey, executorAddress);
        break;
      }
      case 'Set new boot challenger': {
        signed = await setBootChallenger(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      default: {
        console.log('This option has not been implemented');
      }
    }
  } while (!exit);
}

export default startLoop;
