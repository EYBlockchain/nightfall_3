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

/**
UI control loop
*/
async function startLoop() {
  let exit = false;
  let ethereumSigningKey;
  let newEthereumSigningKey;
  do {
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
    } = await askQuestions(ethereumSigningKey);
    if (!privateKey && !ethereumSigningKey) {
      console.log('No private key was provided: exiting');
      return;
    }
    if (privateKey) ethereumSigningKey = `0x${privateKey.slice(2).padStart(64, '0')}`; // once we get a signing key remember it
    if (newPrivateKey) newEthereumSigningKey = `0x${newPrivateKey.slice(2).padStart(64, '0')}`;
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
        await setTokenRestrictions(
          tokenName,
          depositRestriction,
          withdrawRestriction,
          ethereumSigningKey,
        );
        break;
      }
      case 'Remove token restrictions': {
        await removeTokenRestrictions(tokenName, ethereumSigningKey);
        break;
      }
      case 'Unpause contracts': {
        if (!unpause) break;
        await unpauseContracts(ethereumSigningKey);
        break;
      }
      case 'Pause contracts': {
        if (!pause) break;
        await pauseContracts(ethereumSigningKey);
        break;
      }
      case 'Transfer Shield contract balance': {
        await transferShieldBalance(tokenName, Number(amount), ethereumSigningKey);
        break;
      }
      case 'Transfer ownership': {
        await transferOwnership(newEthereumSigningKey, ethereumSigningKey);
        ethereumSigningKey = newEthereumSigningKey;
        break;
      }
      case 'Set new boot proposer': {
        await setBootProposer(newEthereumSigningKey, ethereumSigningKey);
        break;
      }
      case 'Set new boot challenger': {
        await setBootChallenger(newEthereumSigningKey, ethereumSigningKey);
        break;
      }
      default: {
        console.log('This option has not been implemented');
      }
    }
  } while (!exit);
}

export default startLoop;
