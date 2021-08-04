import generateZkpKey from './generate-zkp-key.mjs';
import deposit from './deposit.mjs';
import getContractAddress from './contract-address.mjs';
import transfer from './transfer.mjs';
import withdraw from './withdraw.mjs';
import isMessageValid from './check-message.mjs';
import finaliseWithdrawal from './finalise-withdrawal.mjs';
import peers from './peers.mjs';
import setInstantWithdrawl from './instant-withdrawal.mjs';

export {
  transfer,
  deposit,
  withdraw,
  generateZkpKey,
  getContractAddress,
  isMessageValid,
  finaliseWithdrawal,
  peers,
  setInstantWithdrawl,
};
