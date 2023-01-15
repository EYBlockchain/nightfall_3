/* eslint no-await-in-loop: "off" */

import chai from 'chai';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';

import { getLayer2Balances, Web3Client } from './utils.mjs';

const { expect } = chai;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

async function logProposerStats() {
  logger.info(`proposer stake: ${JSON.stringify(await nf3Proposer.getProposerStake())}`);
  const web3 = nf3Proposer.getWeb3Provider();
  logger.info(
    `-- proposer account balance ---
    ${await web3.eth.getBalance(nf3Proposer.ethereumAddress)}`,
  );
}

describe('Periodic Payment', () => {
  let erc20Address;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.setWeb3Provider();
    const web3 = nf3Proposer.getWeb3Provider();
    logger.info(
      `-- proposer account balance before registration ---
      ${await web3.eth.getBalance(nf3Proposer.ethereumAddress)}`,
    );
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());
    await nf3Proposer.startProposer();

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    const stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    logProposerStats();
  });

  afterEach(async () => logProposerStats());

  it('Do 2 Deposit and make 2 blocks', async function () {
    const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

    await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    await makeBlock();
    await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    await makeBlock();

    const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
    expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue * 2 - fee * 2);
  });

  it('Should do request for payment for two blocks', async () => {
    const blockHashs = (await nf3Proposer.getProposerPendingPayments()).map(rec => rec.blockHash);
    await web3Client.timeJump(3600 * 24 * 10);
    for (const blockHash of blockHashs) {
      await nf3Proposer.requestBlockPayment(blockHash);
    }
    const { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
    expect(Number(feesL2)).to.be.equal(2);
  });

  it('Start periodic payment job', async () => {
    nf3Proposer.startPeriodicPayment('*/03 * * * *'); // At every 3rd minute
    let { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
    while (Number(feesL2) !== 0) {
      await new Promise(reslove => setTimeout(reslove, 600000)); // wait till cron job trigger next and does it job
      ({ feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract());
      logger.debug(feesL2);
    }
    // logger.info(`---- ${JSON.stringify(await nf3Proposer.getPendingWithdrawsFromStateContract())}`);
    // await new Promise(reslove => setTimeout(reslove, 300000)); // wait till cron job trigger next and does it job
    // const { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
    // expect(Number(feesL2)).to.be.equal(0);
  });

  // context('While cron job runing', () => {
  //   it('Do 2 Deposit and make 2 blocks', async function () {
  //     const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

  //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //     await makeBlock();
  //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //     await makeBlock();

  //     const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
  //     expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue * 2 - fee * 2);
  //   });

  //   it('Should do request for block payment and success withdraw as part of cron job', async () => {
  //     const blockHashs = (await nf3Proposer.getProposerPendingPayments()).map(rec => rec.blockHash);
  //     await web3Client.timeJump(3600 * 24 * 10);
  //     for (const blockHash of blockHashs) {
  //       await nf3Proposer.requestBlockPayment(blockHash);
  //     }
  //     let { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
  //     while (Number(feesL2) !== 0) {
  //       await new Promise(reslove => setTimeout(reslove, 600000)); // wait till cron job trigger next and does it job
  //       ({ feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract());
  //       logger.debug(feesL2);
  //     }
  //     // console.log(await nf3Proposer.getPendingWithdrawsFromStateContract());
  //     // await new Promise(reslove => setTimeout(reslove, 600000)); // wait till cron job trigger next and does it job
  //     // const { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
  //     // expect(Number(feesL2)).to.be.equal(0);
  //   });
  // });

  // it('Stop periodic payment job', () => {
  //   nf3Proposer.stopPeriodicPayment();
  //   expect(nf3Proposer.periodicPaymentJob).to.be.equal(undefined);
  // });

  // context('While there is not active cron job runing', () => {
  //   it('Do 2 Deposit and make 2 blocks', async function () {
  //     const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

  //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //     await makeBlock();
  //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //     await makeBlock();

  //     const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
  //     expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue * 2 - fee * 2);
  //   });

  //   it('Should do request for block payment and add then in pendingWithdraw', async () => {
  //     const blockHashs = (await nf3Proposer.getProposerPendingPayments()).map(rec => rec.blockHash);
  //     await web3Client.timeJump(3600 * 24 * 10);
  //     for (const blockHash of blockHashs) {
  //       await nf3Proposer.requestBlockPayment(blockHash);
  //     }
  //     console.log(await nf3Proposer.getPendingWithdrawsFromStateContract());
  //     await new Promise(reslove => setTimeout(reslove, 300000)); // wait till cron job trigger next and does it job (if cron job exist)
  //     const { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
  //     expect(Number(feesL2)).to.be.equal(2);
  //   });
  // });

  // context('Test L1 withdraw with periodic payment cron job', () => {
  //   it('Should withdraw proposer stake', async () => {
  //     await nf3Proposer.deregisterProposer();
  //     await nf3Proposer.withdrawStake();
  //     const { feesL1 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
  //     expect(Number(feesL1)).to.be.equal(1000000);
  //   });

  //   it('Start periodic payment job', async () => {
  //     nf3Proposer.startPeriodicPayment('*/01 * * * *'); // At every 3rd minute
  //     logger.info(
  //       `---- ${JSON.stringify(await nf3Proposer.getPendingWithdrawsFromStateContract())}`,
  //     );
  //     await new Promise(reslove => setTimeout(reslove, 60000)); // wait till cron job trigger and does it job
  //     const { feesL2 } = await nf3Proposer.getPendingWithdrawsFromStateContract();
  //     expect(Number(feesL2)).to.be.equal(0);
  //   });
  // });

  after(async () => {
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
