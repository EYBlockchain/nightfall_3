/* eslint-disable no-await-in-loop */
import { askQuestions } from './menu.mjs';
import { getTokenRestrictions } from '../services/contract-calls.mjs';
import { setTokenRestrictions } from '../services/contract-transactions.mjs';

/**
UI control loop
*/
async function startLoop() {
  let exit = false;
  let ethereumSigningKey;
  do {
    const { task, privateKey, tokenName, depositRestriction, withdrawRestriction } =
      await askQuestions(ethereumSigningKey);
    if (!privateKey && !ethereumSigningKey) {
      console.log('No private key was provided: exiting');
      return;
    }
    if (privateKey) ethereumSigningKey = privateKey; // once we get a signing key remember it
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
        const receipt = await setTokenRestrictions(
          tokenName,
          depositRestriction,
          withdrawRestriction,
          ethereumSigningKey,
        );
        if (receipt === true) console.log('Unknown token. No action taken');
        else
          console.log('Token restrictions were set with transactionHash', receipt.transactionHash);
        break;
      }
      default: {
        console.log('This option has not yet been implemented');
      }
    }
  } while (!exit);
}

export default startLoop;
