/* eslint-disable no-await-in-loop */
import config from 'config';
import { askQuestions } from './menu.mjs';
import { getTokenRestrictions } from '../services/contract-calls.mjs';
import {
  setTokenRestrictions,
  removeTokenRestrictions,
  pauseContracts,
  unpauseContracts,
  transferOwnership,
  setBootProposer,
  setBootChallenger,
} from '../services/contract-transactions.mjs';
import {
  executeMultiSigTransaction,
  verifyTransactions,
  addSignedTransaction,
} from '../services/helpers.mjs';
import { web3 } from '../../../common-files/utils/contract.mjs';

const { MULTISIG } = config;
const { SIGNATURE_THRESHOLD } = MULTISIG;
/**
UI control loop
*/
async function start() {
  let approved; // if we have enough signatures, the signed data is returned
  const {
    task,
    ethereumSigningKey,
    tokenName,
    depositRestriction,
    withdrawRestriction,
    pause,
    unpause,
    newEthereumSigningKey,
    executorAddress,
    nonce,
    signedTx,
    workflow,
  } = await askQuestions(false);
  if (workflow === 'create') {
    switch (task) {
      case 'Get token restrictions': {
        console.log('Token restrictions are:');
        const [deposit, withdraw] = await getTokenRestrictions(tokenName);
        console.log('deposit:', deposit);
        console.log('withdraw:', withdraw);
        break;
      }
      case 'Set token restrictions': {
        approved = await setTokenRestrictions(
          tokenName,
          depositRestriction,
          withdrawRestriction,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Remove token restrictions': {
        approved = await removeTokenRestrictions(
          tokenName,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Unpause contracts': {
        if (!unpause) break;
        approved = await unpauseContracts(ethereumSigningKey, executorAddress);
        break;
      }
      case 'Pause contracts': {
        if (!pause) break;
        approved = await pauseContracts(ethereumSigningKey, executorAddress);
        break;
      }
      case 'Transfer ownership': {
        approved = await transferOwnership(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      case 'Set new boot proposer': {
        approved = await setBootProposer(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      case 'Set new boot challenger': {
        approved = await setBootChallenger(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
        );
        break;
      }
      case 'Import a signed transaction': {
        const verified = verifyTransactions(signedTx); // returns array of signed transaction objects
        if (!verified) break;
        // add new transactions, retaining the last addition as that will contain the entire set
        for (const tx of verified) {
          approved = await addSignedTransaction(tx);
        }
        console.log(approved);
        break;
      }
      default: {
        console.log('This option has not been implemented');
      }
    }
  }
  if (workflow === 'add') {
    const verified = verifyTransactions(signedTx); // returns array of signed transaction objects
    if (verified) {
      // add new transactions, retaining the last addition as that will contain the entire set
      for (const tx of verified) {
        approved = await addSignedTransaction(tx);
      }
    }
  }
  // execute the transaction if we have enough signatures, we need to ask an additional question
  // to get the signing key
  if (approved?.length === SIGNATURE_THRESHOLD) {
    const { executor } = await askQuestions(true);
    console.log('Executing multisig transaction');
    await executeMultiSigTransaction(approved.slice(0, SIGNATURE_THRESHOLD), executor);
  }
  web3.currentProvider.connection.close();
  return JSON.stringify(approved);
}

export default start;
