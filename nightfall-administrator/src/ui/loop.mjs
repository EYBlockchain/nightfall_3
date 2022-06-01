/* eslint-disable no-await-in-loop */
import { askQuestions } from './menu.mjs';
import { getTokenRestrictions } from '../services/contract-calls.mjs';

/**
UI control loop
*/
async function startLoop() {
  let exit = false;
  do {
    const { task, privateKey, tokenName } = await askQuestions();
    if (!privateKey) {
      console.log('No private key was provided: exiting');
      return;
    }
    switch (task) {
      case 'Exit':
        console.log('Exiting normally');
        exit = true;
        break;
      case 'Get token restrictions':
        console.log('Token restrictions are', await getTokenRestrictions(tokenName));
        break;
      default:
        console.log('This option has not yet been implemented');
    }
  } while (!exit);
}

export default startLoop;
