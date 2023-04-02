/* eslint-disable no-await-in-loop */
import chai, { expect } from 'chai';
// import gen from 'general-number';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  getLayer2Balances,
  expectTransaction,
  Web3Client,
  getUserCommitments,
  getClientTransactions,
  restartClient,
} from './utils.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

// const { generalise } = gen;
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

const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('Client synchronisation tests', () => {
  let erc20Address;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);

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
    web3Client.subscribeTo('logs', eventLogs, { address: nf3User.stateContractAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: nf3User.shieldContractAddress });
  });

  describe('Test nightfall-client', () => {
    it('Should do two deposit successfully', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      // first deposit
      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);

      await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);
      const transactions = await getClientTransactions(environment.clientApiUrl);

      // passing of below expect proves that transaction are save in
      // transactionEventHandler
      expect(transactions.length).to.be.equal(1);
      expect(res.transactionHashL2).to.be.equal(transactions[0].transactionHash);

      await makeBlock();

      // second deposit
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue * 2 - fee * 2);
    });

    // this test is to check nightfall-client behaviour in a case
    // where two same transfer transactions is created but second one with higher fee
    context('Test nightfall-client duplicate transaction deletion logic', () => {
      let userCommitments;
      let firstTransfer;
      let userL2BalanceBefore;
      before(async () => {
        userCommitments = await getUserCommitments(
          environment.clientApiUrl,
          nf3User.zkpKeys.compressedZkpPublicKey,
        );
        userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      });

      it('Should successfully create a transfer transaction', async function () {
        const res = await nf3User.transfer(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User2.zkpKeys.compressedZkpPublicKey,
          fee,
          userCommitments.map(c => c.commitmentHash),
        );
        expectTransaction(res);
        firstTransfer = res.transactionHashL2;
        await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);
        const transactions = await getClientTransactions(environment.clientApiUrl);

        expect(transactions.length).to.be.equal(3);
        expect(res.transactionHashL2).to.be.equal(transactions[2].transactionHash);
      });

      it('Should successfully do a transfer with higher fee with create block', async function () {
        let transactions;
        const res = await nf3User.transfer(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          fee + 1,
          userCommitments.map(c => c.commitmentHash),
        );
        expectTransaction(res);

        transactions = await getClientTransactions(environment.clientApiUrl);
        expect(transactions.length).to.be.equal(3);
        expect(firstTransfer).to.be.equal(transactions[2].transactionHash);

        // here we will also test client resync atleast for TransactionSubmitEvent Handler
        await restartClient(nf3User);

        transactions = await getClientTransactions(environment.clientApiUrl);
        // if below expect passes it proves client resync is working.
        expect(transactions.length).to.be.equal(4);
        expect(res.transactionHashL2).to.be.equal(transactions[3].transactionHash);

        await makeBlock();
        const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
        expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - (fee + 1));
        transactions = await getClientTransactions(environment.clientApiUrl);
        // if below expect passes it proves blockEventHandler delete duplicate transaction is working.
        expect(transactions.length).to.be.equal(3);
        expect(res.transactionHashL2).to.be.equal(transactions[2].transactionHash);
      });
    });
  });
});
