/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';
import { getLayer2Balances, expectTransaction, Web3Client } from '../utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

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
let rollbackCount = 0;

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

async function logProposerStats() {
  logger.info(`proposer stake: ${await nf3Proposer.getProposerStake()}`);
  const web3 = nf3Proposer.getWeb3Provider();
  logger.info(
    `-- proposer account balance ---
    ${await web3.eth.getBalance(nf3Proposer.ethereumAddress)}`,
  );
}

describe('Cron Job test', () => {
  let erc20Address;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3Challenger.init(mnemonics.challenger);
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.setWeb3Provider();
    const web3 = nf3Proposer.getWeb3Provider();
    logger.info(
      `-- proposer account balance before registration ---
      ${await web3.eth.getBalance(nf3Proposer.ethereumAddress)}`,
    );
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });

    await nf3Challenger.startChallenger();

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    logProposerStats();
  });

  describe('Proposer payments', () => {
    afterEach(async () => {
      logProposerStats();
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
        nf3Proposer.getPendingWithdrawsFromStateContract(),
      );
    });

    it('withdraw proposer stake', async () => {
      await nf3Proposer.deregisterProposer();
      await web3Client.timeJump(3600 * 24 * 10);
      await nf3Proposer.withdrawStake();
      console.log(
        '-------getPendingWithdrawsFromStateContract---------',
        nf3Proposer.getPendingWithdrawsFromStateContract(),
      );
    });
  });

  after(async () => {
    // delay added to wait for cron-job to do its job
    await new Promise(reslove => setTimeout(reslove, 300000));
    logProposerStats();
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
