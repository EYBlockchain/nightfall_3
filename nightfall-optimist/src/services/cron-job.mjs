/* eslint no-await-in-loop: "off" */

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

async function withdrawPendingWithdraw(entity) {
  const rawTransactions = [];
  for (const account of entity) {
    const balances = await stateContractInstance.methods.pendingWithdrawalsFees(account._id).call();
    console.log('---account._id----', account._id, '---balances---', balances);
    if (
      // gas used/user gas limit  * (base fee + priority fee) * offset-margin
      // in wei. This logic should be in mainnet, but instead take min-fees from configs
      Number(balances.feesL1) >= MIN_L1_FEES ||
      Number(balances.feesL2) >= MIN_L2_FEES
    ) {
      console.log('--encodeABI--', await stateContractInstance.methods.withdraw().encodeABI());
      rawTransactions.push(await stateContractInstance.methods.withdraw().encodeABI());
    }
  }
  return rawTransactions;
}

// 00 00 00 * * */06
const job = new CronJob('* * */01 * * *', async function () {
  console.log('-------in CronJob -------');
  if (!stateContractInstance) {
    stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  }

  const proposers = await getAllRegisteredProposers();
  const challengers = await getAllRegisteredChallengers();

  const proposerWithdrawRawTx = await withdrawPendingWithdraw(proposers);
  const challengerWithdrawRawTx = await withdrawPendingWithdraw(challengers);

  console.log(
    '----- proposerWithdrawRawTx challengerWithdrawRawTx --',
    proposerWithdrawRawTx,
    challengerWithdrawRawTx,
  );
  for (const rawTx of proposerWithdrawRawTx) {
    console.log('--rawTx---', rawTx);
    if (rawTx !== '') return;
    await sendRawTransactionToWebSocketOfProposer(rawTx);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  for (const rawTx of challengerWithdrawRawTx) {
    await sendRawTransactionToWebSocketOfChallenger(rawTx);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
});

job.start();
