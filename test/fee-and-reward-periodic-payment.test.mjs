/* eslint no-await-in-loop: "off" */

import chai from 'chai';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';

import { getLayer2Balances, expectTransaction, Web3Client } from './utils.mjs';

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

  it('Deposit: Should increment user L2 balance after depositing some ERC20', async function () {
    const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

    const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    expectTransaction(res);
    logger.debug(`Gas used was ${Number(res.gasUsed)}`);
    await makeBlock();

    const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
    expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
  });

  it('Deposit: Should increment user L2 balance after depositing some ERC20', async function () {
    const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

    const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    expectTransaction(res);
    logger.debug(`Gas used was ${Number(res.gasUsed)}`);
    await makeBlock();

    const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
    expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
  });

  it('Should do request for payment for two blocks', async () => {
    const blockHashs = (await nf3Proposer.getProposerPendingPayments()).map(rec => rec.blockHash);
    await web3Client.timeJump(3600 * 24 * 10);
    for (const blockHash of blockHashs) {
      await nf3Proposer.requestBlockPayment(blockHash);
    }
    console.log(
      '-------getPendingWithdrawsFromStateContract---------',
      await nf3Proposer.getPendingWithdrawsFromStateContract(),
    );
  });

  after(async () => {
    await new Promise(reslove => setTimeout(reslove, 30000));
    logProposerStats();
    console.log(
      '-------getPendingWithdrawsFromStateContract---------',
      await nf3Proposer.getPendingWithdrawsFromStateContract(),
    );
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
