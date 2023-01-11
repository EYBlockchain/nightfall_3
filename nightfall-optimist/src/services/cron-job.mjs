import { CronJob } from 'cron';
import config from 'config';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

import { getAllRegisteredProposers, getAllRegisteredChallengers } from './database.mjs';
import { sendRawTransactionToWebSocket as sendRawTransactionToWebSocketOfProposer } from './block-assembler.mjs';
import { sendRawTransactionToWebSocket as sendRawTransactionToWebSocketOfChallenger } from './challenges.mjs';

const { MIN_L1_FEES, MIN_L2_FEES } = config;
const { STATE_CONTRACT_NAME } = constants;

let stateContractInstance;

function withdrawPendingWithdraw(entity) {
  return entity.map(async account => {
    let rawTransaction;
    const balances = await stateContractInstance.methods.pendingWithdrawalsFees(account._id).call();
    console.log('---account._id----', account._id, '---balances---', balances);
    if (
      // gas used/user gas limit  * (base fee + priority fee) * offset-margin
      // in wei. This logic should be in mainnet, but instead take min-fees from configs
      balances.feesL1 >= MIN_L1_FEES ||
      balances.feesL2 >= MIN_L2_FEES
    ) {
      rawTransaction = await stateContractInstance.methods.withdraw().encodeABI();
    }
    return rawTransaction;
  });
}

// 00 00 00 * * */06
const job = new CronJob('* */01 * * * *', async function () {
  console.log('-------in CronJob -------');
  if (!stateContractInstance) {
    stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  }

  const proposers = await getAllRegisteredProposers();
  const challengers = await getAllRegisteredChallengers();

  const proposerWithdrawRawTx = await withdrawPendingWithdraw(proposers);
  const challengerWithdrawRawTx = await withdrawPendingWithdraw(challengers);

  console.log(
    '---proposerWithdrawRawTx, challengerWithdrawRawTx--',
    proposerWithdrawRawTx,
    challengerWithdrawRawTx,
  );

  proposerWithdrawRawTx.forEach(async rawTx => {
    console.log('prop--rawTx-', rawTx);
    if (!rawTx) return;
    await sendRawTransactionToWebSocketOfProposer(rawTx);
    await new Promise(resolve => setTimeout(3000, resolve));
  });

  challengerWithdrawRawTx.forEach(async rawTx => {
    if (!rawTx) return;
    console.log('challenger--rawTx-', rawTx);
    await sendRawTransactionToWebSocketOfChallenger(rawTx);
    await new Promise(resolve => setTimeout(3000, resolve));
  });
});

job.start();
