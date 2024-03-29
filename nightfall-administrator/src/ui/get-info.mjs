/* eslint-disable no-await-in-loop */
import config from 'config';
import { web3, waitForContract } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import { askQuestions } from './menu.mjs';
import { getTokenRestrictions, isWhitelistManager } from '../services/contract-calls.mjs';
import {
  setTokenRestrictions,
  removeTokenRestrictions,
  pauseContracts,
  unpauseContracts,
  transferOwnership,
  setBootProposer,
  setBootChallenger,
  createWhitelistManager,
  removeWhitelistManager,
  enableWhitelisting,
} from '../services/contract-transactions.mjs';
import {
  executeMultiSigTransaction,
  verifyTransactions,
  addSignedTransaction,
} from '../services/helpers.mjs';

const { MULTISIG } = config;
const { SIGNATURE_THRESHOLD } = MULTISIG;

// UI control loop
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
    managerAddress,
    managerGroupId,
  } = await askQuestions(false);
  if (workflow === 'create') {
    switch (task) {
      case 'Get token restrictions': {
        const [deposit, withdraw] = await getTokenRestrictions(tokenName);
        console.log('Token restrictions are', deposit, withdraw);
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
      case 'Add whitelist manager': {
        approved = await createWhitelistManager(
          managerGroupId,
          managerAddress,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Remove whitelist manager': {
        approved = await removeWhitelistManager(
          managerAddress,
          ethereumSigningKey,
          executorAddress,
          nonce,
        );
        break;
      }
      case 'Enable whitelisting': {
        approved = await enableWhitelisting(true, ethereumSigningKey, executorAddress, nonce);
        break;
      }
      case 'Disable whitelisting': {
        approved = await enableWhitelisting(false, ethereumSigningKey, executorAddress, nonce);
        break;
      }
      case 'Check if address is a whitelist manager': {
        const groupId = await isWhitelistManager(managerAddress);
        if (groupId) console.log('This address is a manager with group Id', groupId);
        else console.log('This address is not a manager');
        break;
      }
      default: {
        logger.error('This option has not been implemented');
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
      let nonceTmp = nonce;
      if (!nonceTmp) {
        const multiSigInstance = await waitForContract('SimpleMultiSig');
        nonceTmp = await multiSigInstance.methods.nonce().call();
      }
      logger.info({
        msg: 'get nonce',
        nonceTmp,
      });
    } catch (err) {
      logger.error({
        msg: 'Could not get nonce. Are you connected to the blockchain?',
        err,
      });
    }
  }

  /*
   execute the transaction if we have enough signatures, we need to ask an additional question
   to get the signing key
   Sometimes we sign more than on transaction at a time (for example if we wish to pause several
   contracts).  Hence 'approved' is an array of arrays (each element being the approvals for a given contract)
  */
  let executor;
  for (const approval of approved) {
    if (approval?.length === SIGNATURE_THRESHOLD) {
      if (!executor) executor = (await askQuestions(true)).executor; // get the executor private key if we don't have it
      logger.info('Executing multisig transaction');
      await executeMultiSigTransaction(approval.slice(0, SIGNATURE_THRESHOLD), executor);
    }
  }
  web3.currentProvider.connection.close();
  return JSON.stringify(approved);
}

export default start;
