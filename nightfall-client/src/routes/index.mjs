import deposit from './deposit.mjs';
import getContractAddress from './contract-address.mjs';
import getContractVersion from './contract-version.mjs';
import transfer from './transfer.mjs';
import withdraw from './withdraw.mjs';
import finaliseWithdrawal from './finalise-withdrawal.mjs';
import isValidWithdrawal from './valid-withdrawal.mjs';
import peers from './peers.mjs';
import commitment from './commitment.mjs';
import incomingViewingKey from './incoming-viewing-key.mjs';
import setInstantWithdrawl from './instant-withdrawal.mjs';
import generateKeys from './generate-keys.mjs';

export {
  transfer,
  deposit,
  withdraw,
  getContractAddress,
  getContractVersion,
  finaliseWithdrawal,
  isValidWithdrawal,
  peers,
  commitment,
  incomingViewingKey,
  setInstantWithdrawl,
  generateKeys,
};
