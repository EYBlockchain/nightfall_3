/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import axios from 'axios';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  depositNTransactions,
  transferNTransactions,
  withdrawNTransactions,
  Web3Client,
  expectTransaction,
  pendingCommitmentCount,
  waitForTimeout,
  topicEventMapping,
} from './utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// we need require here to import jsons
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  MINIMUM_STAKE,
} = config.TEST_OPTIONS;

const txPerBlock = process.env.TRANSACTIONS_PER_BLOCK || 32;
const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];

const averageL1GasCost = receipts =>
  receipts.map(receipt => receipt.gasUsed).reduce((acc, el) => acc + el) / receipts.length;

const emptyL2 = async () => {
  await new Promise(resolve => setTimeout(resolve, 6000));
  let count = await pendingCommitmentCount(nf3Users[0]);
  while (count !== 0) {
    await nf3Users[0].makeBlockNow();
    try {
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      count = await pendingCommitmentCount(nf3Users[0]);
    } catch (err) {
      break;
    }
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
};

describe('Gas test', () => {
  let gasCost = 0;

  before(async () => {
    await axios.post('http://localhost:8092/proposer', {
      bond: MINIMUM_STAKE,
      url: 'http://proposer',
    });

    web3Client
      .getWeb3()
      .eth.subscribe('logs')
      .on('data', async log => {
        if (log.topics.includes(topicEventMapping.BlockProposed)) {
          const receipt = await web3Client.getWeb3().eth.getTransactionReceipt(log.transactionHash);
          console.log('gas', receipt.gasUsed);
          gasCost = receipt.gasUsed;
        }
      });

    await nf3Users[0].init(mnemonics.user1);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await depositNTransactions(
      nf3Users[0],
      txPerBlock,
      erc20Address,
      tokenType,
      transferValue,
      tokenId,
      0,
    );
    await emptyL2();
  });

  beforeEach(async () => {
    await emptyL2();
  });

  describe('Deposits', () => {
    it('should be a reasonable gas cost', async function () {
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
      await emptyL2();

      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log('Deposit L1 average gas used was', averageL1GasCost(receipts));
    });
  });

  describe('Single transfers', () => {
    it('should be a reasonable gas cost', async function () {
      // We create enough transactions to fill blocks full of deposits.
      const receipts = await transferNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].zkpKeys.compressedZkpPublicKey,
        0,
      );
      await emptyL2();

      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log(
        'Single transfer L1 average gas used, if on-chain, was',
        averageL1GasCost(receipts),
      );
    });
  });

  describe('Double transfers', () => {
    it('should be a reasonable gas cost', async function () {
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
      await emptyL2();

      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log(
        'Double transfer L1 average gas used, if on-chain, was',
        averageL1GasCost(receipts),
      );
    });
  });

  describe('Withdraws', () => {
    it('should be a reasonable gas cost', async function () {
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
      await emptyL2();

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
        const rec = await nf3Users[0].withdraw(
          false,
          erc20Address,
          tokenType,
          Math.floor(transferValue / 2),
          tokenId,
          nf3Users[0].ethereumAddress,
          fee,
        );
        expectTransaction(rec);

        await emptyL2();

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
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  after(async () => {
    await axios.delete('http://localhost:8092/proposer');
  });
});
