import deposit from './deposit.mjs';
import getContractAddress from './contract-address.mjs';
import transfer from './transfer.mjs';
import withdraw from './withdraw.mjs';
import isMessageValid from './check-message.mjs';
import finaliseWithdrawal from './finalise-withdrawal.mjs';
import peers from './peers.mjs';
import commitment from './commitment.mjs';
import incomingViewingKey from './incomingViewingKey.mjs';
import setInstantWithdrawl from './instant-withdrawal.mjs';
import generateKeys from './generate-keys.mjs';

export {
  transfer,
  deposit,
  withdraw,
  getContractAddress,
  isMessageValid,
  finaliseWithdrawal,
  peers,
  commitment,
  incomingViewingKey,
  setInstantWithdrawl,
  generateKeys,
};
