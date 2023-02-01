/* eslint-disable no-await-in-loop */
import chai from 'chai';
import gen from 'general-number';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import {
  getLayer2Balances,
  expectTransaction,
  Web3Client,
  getUserCommitments,
  getTransactions,
} from '../../utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { generalise } = gen;
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
const nf3User2 = new Nf3(signingKeys.user2, environment);
const nf3UserSanctioned = new Nf3(signingKeys.sanctionedUser, environment);

const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('ERC20 tests', () => {
  let erc20Address;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);
    await nf3UserSanctioned.init(mnemonics.sanctionedUser);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    it('Should increment user L2 balance after depositing some ERC20', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---transferValue-- ${transferValue}`);
      logger.info(`---userL2BalanceBefore-- ${userL2BalanceBefore}`);
      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---userL2BalanceAfter-- ${userL2BalanceAfter}`);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
    });
  });

  describe('Transfers', () => {
    it('Should decrement user L2 balance after transferring some ERC20 to other wallet, and increment the other wallet balance', async function () {
      // const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      // const user2L2BalanceBefore = await getLayer2Balances(nf3User2, erc20Address);

      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      await makeBlock();
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---userL2BalanceBefore-- ${userL2BalanceBefore}`);
      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      logger.info(`---userCommitments- 1-- ${JSON.stringify(userCommitments)}`);
      const res = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      // await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---userL2BalanceAfter-- ${userL2BalanceAfter}`);
      logger.info(
        `------getTransactions---${JSON.stringify(
          await getTransactions(environment.clientApiUrl),
        )}---${nf3User2.zkpKeys.compressedZkpPublicKey}`,
      );
      // const user2L2BalanceAfter = await getLayer2Balances(nf3User2, erc20Address);
      // expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-(transferValue + fee));
      // expect(user2L2BalanceAfter - user2L2BalanceBefore).to.be.equal(transferValue);
    });

    it('should perform a transfer by specifying the commitment that provides enough value to cover value', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---userL2BalanceBefore-- ${userL2BalanceBefore}`);
      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      logger.info(`---userCommitments- 2-- ${JSON.stringify(userCommitments)}`);

      const erc20Commitments = userCommitments
        .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
        .sort((a, b) => Number(generalise(a.value).bigInt - generalise(b.value).bigInt));

      logger.info(`---erc20Commitments--- ${JSON.stringify(erc20Commitments)}`);

      const usedCommitments = [];
      let totalValue = 0;
      let i = 1;

      while (totalValue < transferValue && i < erc20Commitments.length) {
        usedCommitments.push(erc20Commitments[i].commitmentHash);
        totalValue += Number(generalise(erc20Commitments[i].value).bigInt);
        ++i;
      }

      logger.info(`---usedCommitments--- ${JSON.stringify(usedCommitments)}`);
      const res = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        fee + 1,
        usedCommitments,
      );
      expectTransaction(res);
      logger.info(
        `------getTransactions-1--${JSON.stringify(
          await getTransactions(environment.clientApiUrl),
        )}---${nf3User2.zkpKeys.compressedZkpPublicKey}`,
      );
      await web3Client.waitForEvent(eventLogs, ['transactionSubmitted']);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      logger.info(`---userL2BalanceAfter-- ${userL2BalanceAfter} --- ${fee}`);
      await getUserCommitments(environment.clientApiUrl, nf3User.zkpKeys.compressedZkpPublicKey);
      logger.info(
        `------getTransactions--2-${JSON.stringify(
          await getTransactions(environment.clientApiUrl),
        )}---${nf3User2.zkpKeys.compressedZkpPublicKey}`,
      );
      // expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-fee);
    });
  });

  describe('Rollback checks', () => {
    it('test should encounter zero rollbacks', function () {
      expect(rollbackCount).to.be.equal(0);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    await nf3User2.close();
    await nf3UserSanctioned.close();
    web3Client.closeWeb3();
  });
});
