/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  depositNTransactions,
  transferNTransactions,
  withdrawNTransactions,
  Web3Client,
  expectTransaction,
  waitForTimeout,
  clearMempool,
} from './utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// we need require here to import jsons
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS, VK_IDS } = config;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];

const averageL1GasCost = receipts =>
  receipts.map(receipt => receipt.gasUsed).reduce((acc, el) => acc + el) / receipts.length;

describe('Gas test', () => {
  let gasCost;
  let txPerBlock;
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('receipt', async receipt => {
      const { gasUsed } = receipt;
      console.log(
        `Block proposal gas used was ${gasUsed}, gas used per transaction was ${
          gasUsed / txPerBlock
        }`,
      );
      gasCost = gasUsed;
    });

    await nf3Users[0].init(mnemonics.user1);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
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

    after(async () => {
      await clearMempool({
        optimistUrl: environment.optimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });

    it('should be a reasonable gas cost', async function () {
      console.log(`Creating a block with ${txPerBlock - 1} deposits`);

      // We create enough transactions to fill blocks full of deposits.
      const receipts = await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log('Deposit L1 average gas used was', averageL1GasCost(receipts));
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

    after(async () => {
      await clearMempool({
        optimistUrl: environment.optimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });

    it('should be a reasonable gas cost', async function () {
      console.log(`Creating a block with ${txPerBlock - 1} transfers`);

      // We create enough transactions to fill blocks full of deposits.
      const receipts = await transferNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue / 2,
        tokenId,
        nf3Users[0].zkpKeys.compressedZkpPublicKey,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log('Transfer L1 average gas used, if on-chain, was', averageL1GasCost(receipts));
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

    afterEach(async () => {
      await clearMempool({
        optimistUrl: environment.optimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });

    it('should be a reasonable gas cost', async function () {
      console.log(`Creating a block with ${txPerBlock - 1} withdraws`);

      // We create enough transactions to fill blocks full of deposits.
      const receipts = await withdrawNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue / 2,
        tokenId,
        nf3Users[0].ethereumAddress,
        0,
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log('Withdraw L1 average gas used, if on-chain, was', averageL1GasCost(receipts));
    });
  });

  describe('Finalise withdraws', () => {
    it('should withdraw from L2, checking for L1 balance (only with time-jump client)', async function () {
      const nodeInfo = await web3Client.getInfo();
      if (nodeInfo.includes('TestRPC')) {
        waitForTimeout(10000);
        const startBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);
        const withdrawal = await nf3Users[0].getLatestWithdrawHash();
        await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days
        const commitments = await nf3Users[0].getPendingWithdraws();
        expect(
          commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc20Address].length,
        ).to.be.greaterThan(0);
        expect(
          commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc20Address].filter(
            c => c.valid === true,
          ).length,
        ).to.be.greaterThan(0);
        const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
        expectTransaction(res);
        const endBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);
        expect(parseInt(endBalance, 10)).to.be.lessThan(parseInt(startBalance, 10));
        console.log('The gas used for finalise withdraw, back to L1, was', res.gasUsed);
      } else {
        console.log('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await web3Client.closeWeb3();
  });
});
