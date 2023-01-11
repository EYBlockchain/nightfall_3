import { CronJob } from 'cron';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

import { getAllRegisteredProposers, getAllRegisteredChallengers } from './database.mjs';

const { STATE_CONTRACT_NAME } = constants;

async function withdrawPendingWithdraw(entity) {
  return entity.map(async account => {
    const balances = await stateContractInstance.methods.pendingWithdrawalsFees(account._id).call();
    console.log('---account._id----', account._id, '---balances---', balances);
    // gas used/user gas limit  * (base fee + priority fee) * offset-margin
    // in wei
    if (balances.feesL1 > 21000 * (10000000000 + 2000000000) * 10) {
      console.log('---- feesL1 --- enough balance');
    }
    if (balances.feesL2 > 0) {
      console.log('---- feesL2 --- enough balance');
      return (await stateContractInstance.methods.withdraw().encodeABI());
    }
    return null;
  });
}

// 00 00 00 * * */06
const job = new CronJob('* */01 * * * *', async function () {
  console.log('-------in CronJob -------');
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);

  const proposers = await getAllRegisteredProposers();
  const challengers = await getAllRegisteredChallengers();

  const proposerWithdrawRawTx = await withdrawPendingWithdraw(proposers);
  const challengerWithdrawRawTx = await withdrawPendingWithdraw(challengers);

  console.log(proposerWithdrawRawTx, challengerWithdrawRawTx);

  // [...proposers, ...challengers].map(async account => {
  //   const balances = await stateContractInstance.methods.pendingWithdrawalsFees(account._id).call();

  //   console.log('---account._id----', account._id, '---balances---', balances);

  //   // gas used/user gas limit  * (base fee + priority fee) * offset-margin
  //   // in wei
  //   if (balances.feesL1 > 21000 * (10000000000 + 2000000000) * 10) {
  //     console.log('---- feesL1 --- enough balance');
  //   }
  //   if (balances.feesL2 > 0) {
  //     console.log('---- feesL2 --- enough balance');
  //     const txDataToSign = await stateContractInstance.methods.withdraw().encodeABI();
  //     console.log('---------CronJob---txDataToSign----', txDataToSign);
  //   }
  // });
});

job.start();
