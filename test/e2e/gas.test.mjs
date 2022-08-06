/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  depositNTransactions,
  transferNTransactions,
  withdrawNTransactions,
  Web3Client,
  expectTransaction,
  waitForTimeout,
} from '../utils.mjs';

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
} = config.TEST_OPTIONS;

const txPerBlock = process.env.TRANSACTIONS_PER_BLOCK || 32;
const expectedGasCostPerTx = 100000 + 15000 * txPerBlock;
const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];

const averageL1GasCost = receipts =>
  receipts.map(receipt => receipt.gasUsed).reduce((acc, el) => acc + el) / receipts.length;

/*
  This function tries to zero the number of unprocessed transactions in the optimist node
  that nf3 is connected to. We call it extensively on the tests, as we want to query stuff from the
  L2 layer, which is dependent on a block being made. We also need 0 unprocessed transactions by the end
  of the tests, otherwise the optimist will become out of sync with the L2 block count on-chain.
*/
const emptyL2 = async nf3Instance => {
  let count = await nf3Instance.unprocessedTransactionCount();
  while (count !== 0) {
    if (count % txPerBlock) {
      const tx = (count % txPerBlock) - 1;
      for (let i = 0; i < tx; i++) {
        eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      }
    } else {
      const tx = txPerBlock - count;

      await depositNTransactions(
        nf3Instance,
        tx,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );

      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      count = await nf3Instance.unprocessedTransactionCount();
    }
  }
};

describe('Gas test', () => {
  let gasCost = 0;
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
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
    // we need more deposits because we won't have enough input transactions until
    // after this block is made, by which time it's too late.
    // also,the first  block costs more due to one-off setup costs.
    it('should make extra deposits so that we can double-transfer', async function () {
      // We create enough transactions to fill blocks full of deposits.
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
    });
    it('should be a reasonable gas cost', async function () {
      // We create enough transactions to fill blocks full of deposits.
      const receipts = await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
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
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
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
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
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
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
      console.log('Withdraw L1 average gas used, if on-chain, was', averageL1GasCost(receipts));
    });
  });

  describe('Finalise withdraws', () => {
    it('should withdraw from L2, checking for L1 balance (only with time-jump client)', async function () {
      const nodeInfo = await web3Client.getInfo();
      if (nodeInfo.includes('TestRPC')) {
        waitForTimeout(5000);
        const startBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);
        const withdrawal = await nf3Users[0].getLatestWithdrawHash();
        await emptyL2(nf3Users[0]);
        await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days
        const commitments = await nf3Users[0].getPendingWithdraws();
        console.log('Withdraw Commitments', commitments);
        console.log('CompressedZKP', commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey]);
        console.log('L2 Commitments', await nf3Users[0].getLayer2Commitments());
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
    await emptyL2(nf3Users[0]);
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await web3Client.closeWeb3();
  });
});
