/* eslint-disable no-await-in-loop */
import chai from 'chai';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  depositNTransactions,
  transferNTransactions,
  withdrawNTransactions,
  Web3Client,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;
const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS, VK_IDS } = config;
const { MONGO_URL, OPTIMIST_DB } = config;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
nf3Proposer.setApiKey(environment.AUTH_TOKEN);

const connection = await mongo.connection(MONGO_URL);
const db = connection.db(OPTIMIST_DB);
const countBlocksInOptimist = async () => db.collection('blocks').count();

const averageL1GasCost = receipts =>
  receipts.map(receipt => receipt.gasUsed).reduce((acc, el) => acc + el) / receipts.length;

async function getLatestBlockGasUsed() {
  const latestBlock = await db
    .collection('blocks')
    .find()
    .sort({ blockNumberL2: -1 })
    .limit(1)
    .toArray();

  const latestBlockTxHashL1 = latestBlock[0].transactionHashL1;

  const receipt = await web3Client.getTransactionReceipt(latestBlockTxHashL1);

  return receipt.gasUsed;
}

async function processMempoolTransactions() {
  const mempoolTransactions = await nf3Proposer.unprocessedTransactionCount();
  if (mempoolTransactions > 0) {
    logger.debug(`Making new block to clear transaction mempool...`);
    await nf3Proposer.makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
  }
}

describe('Gas test', () => {
  let txPerBlock;
  let erc20Address;
  let stateAddress;

  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    await nf3User.init(mnemonics.user1);
    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    before(() => {
      const txSize =
        (MINIMUM_TRANSACTION_SLOTS +
          VK_IDS.deposit.numberNullifiers +
          Math.ceil(VK_IDS.deposit.numberNullifiers / 4) +
          VK_IDS.deposit.numberCommitments) *
        32;
      txPerBlock = Math.ceil(MAX_BLOCK_SIZE / txSize);
    });

    it('should be a reasonable gas cost', async function () {
      logger.debug(`Creating a block with ${txPerBlock - 1} deposits`);

      const numberOfBlocksBefore = await countBlocksInOptimist();

      // We create enough transactions to fill blocks full of deposits
      const receipts = await depositNTransactions(
        nf3User,
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const numberOfBlocksAfter = await countBlocksInOptimist();

      expect(numberOfBlocksBefore).to.be.equal(numberOfBlocksAfter - 1);

      const gasCostDeposit = await getLatestBlockGasUsed();

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCostDeposit).to.be.lessThan(expectedGasCostPerTx);
      logger.debug(`Deposit L1 average gas used was ${averageL1GasCost(receipts)}`);

      await processMempoolTransactions();
    });
  });

  describe('Transfers', () => {
    before(() => {
      const txSize =
        (MINIMUM_TRANSACTION_SLOTS +
          VK_IDS.transfer.numberNullifiers +
          Math.ceil(VK_IDS.transfer.numberNullifiers / 4) +
          VK_IDS.transfer.numberCommitments) *
        32;
      txPerBlock = Math.ceil(MAX_BLOCK_SIZE / txSize);
    });

    it('should be a reasonable gas cost', async function () {
      logger.debug(`Creating a block with ${txPerBlock - 1} transfers`);

      const numberOfBlocksBefore = await countBlocksInOptimist();

      // We create enough transactions to fill blocks full of transfers
      const receipts = await transferNTransactions(
        nf3User,
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue / 2,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const numberOfBlocksAfter = await countBlocksInOptimist();

      expect(numberOfBlocksBefore).to.be.equal(numberOfBlocksAfter - 1);

      const gasCostTransfer = await getLatestBlockGasUsed();

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCostTransfer).to.be.lessThan(expectedGasCostPerTx);
      logger.debug(`Transfer L1 average gas used, if on-chain, was ${averageL1GasCost(receipts)}`);

      await processMempoolTransactions();
    });
  });

  describe('Withdraws', () => {
    before(() => {
      const txSize =
        (MINIMUM_TRANSACTION_SLOTS +
          VK_IDS.withdraw.numberNullifiers +
          Math.ceil(VK_IDS.withdraw.numberNullifiers / 4) +
          VK_IDS.withdraw.numberCommitments) *
        32;
      txPerBlock = Math.ceil(MAX_BLOCK_SIZE / txSize);
    });

    it('should be a reasonable gas cost', async function () {
      logger.debug(`Creating a block with ${txPerBlock - 1} withdraws`);

      const numberOfBlocksBefore = await countBlocksInOptimist();

      // We create enough transactions to fill blocks full of withdrawals
      const receipts = await withdrawNTransactions(
        nf3User,
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue / 2,
        tokenId,
        nf3User.ethereumAddress,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const numberOfBlocksAfter = await countBlocksInOptimist();

      expect(numberOfBlocksBefore).to.be.equal(numberOfBlocksAfter - 1);

      const gasCostWithdrawal = await getLatestBlockGasUsed();

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCostWithdrawal).to.be.lessThan(expectedGasCostPerTx);
      logger.debug(`Withdraw L1 average gas used, if on-chain, was ${averageL1GasCost(receipts)}`);

      await processMempoolTransactions();
    });
  });

  after(async () => {
    await connection.close();
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
