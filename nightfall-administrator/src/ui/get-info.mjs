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
import { web3, waitForContract } from '../../../common-files/utils/contract.mjs';

const { MULTISIG } = config;
const { SIGNATURE_THRESHOLD } = MULTISIG;
/**
UI control loop
*/
async function start() {
  let approved = []; // if we have enough signatures, the signed data is returned
  const {
    task,
    ethereumSigningKey,
    tokenName,
    depositRestriction,
    withdrawRestriction,
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
        approved = await unpauseContracts(ethereumSigningKey, executorAddress, nonce);
        break;
      }
      case 'Pause contracts': {
        approved = await pauseContracts(ethereumSigningKey, executorAddress, nonce);
        break;
      }
      case 'Transfer ownership': {
        approved = await transferOwnership(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Set new boot proposer': {
        approved = await setBootProposer(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Set new boot challenger': {
        approved = await setBootChallenger(
          newEthereumSigningKey,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
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
      for (const txs of verified) {
        let approvals;
        for (const tx of txs) {
          approvals = await addSignedTransaction(tx);
        }
        approved.push(approvals);
      }
    }
  }
  if (workflow === 'get nonce') {
    try {
      if (!nonce) {
        const multiSigInstance = await waitForContract('SimpleMultiSig');
        console.log('Nonce is', await multiSigInstance.methods.nonce().call());
      } else console.log('Nonce is', nonce);
    } catch (err) {
      console.log('Could not get nonce.  Are you connected to the blockchain?');
    }
  }
  // execute the transaction if we have enough signatures, we need to ask an additional question
  // to get the signing key
  // Sometimes we sign more than on transaction at a time (for example if we wish to pause several
  // contracts).  Hence 'approved' is an array of arrays (each element being the approvals for a given contract)
  let executor;
  for (const approval of approved) {
    if (approval?.length === SIGNATURE_THRESHOLD) {
      if (!executor) executor = (await askQuestions(true)).executor; // get the executor private key if we don't have it
      console.log('Executing multisig transaction');
      await executeMultiSigTransaction(approval.slice(0, SIGNATURE_THRESHOLD), executor);
    }
  }
  web3.currentProvider.connection.close();
  return JSON.stringify(approved);
}

export default start;
