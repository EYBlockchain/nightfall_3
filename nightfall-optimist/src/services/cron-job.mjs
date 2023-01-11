import { CronJob } from 'cron';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

import { getAllRegisteredProposers, getAllRegisteredChallengers } from './database.mjs';
import { sendRawTransactionToWebSocket as sendRawTransactionToWebSocketOfProposer } from './block-assembler.mjs';
import { sendRawTransactionToWebSocket as sendRawTransactionToWebSocketOfChallenger } from './challenges.mjs';
import { resolve } from 'path/posix';

const { STATE_CONTRACT_NAME } = constants;

let stateContractInstance;

function withdrawPendingWithdraw(entity) {
  return entity.map(async account => {
    let rawTransaction;
    const balances = await stateContractInstance.methods.pendingWithdrawalsFees(account._id).call();
    console.log('---account._id----', account._id, '---balances---', balances);
    if (
      // gas used/user gas limit  * (base fee + priority fee) * offset-margin
      // in wei
      balances.feesL1 > 21000 * (10000000000 + 2000000000) * 10 ||
      balances.feesL2 > 0
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

  console.log(proposerWithdrawRawTx, challengerWithdrawRawTx);

  proposerWithdrawRawTx.forEach(async (rawTx) => {
    await sendRawTransactionToWebSocketOfProposer(rawTx);
    await new Promise(resolve => setTimeout(3000, resolve));
  });

  challengerWithdrawRawTx.forEach(async (rawTx) => {
    await sendRawTransactionToWebSocketOfChallenger(rawTx);
    await new Promise(resolve => setTimeout(3000, resolve));
  });
});

job.start();
