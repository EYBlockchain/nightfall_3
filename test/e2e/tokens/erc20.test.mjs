/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { expectTransaction, depositNTransactions, Web3Client } from '../../utils.mjs';

import { approve } from '../../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const { RESTRICTIONS: defaultRestrictions } = config;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];
const logs = {
  instantWithdraw: 0,
};
const waitForTxExecution = async (count, txType) => {
  while (count === logs[txType]) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};

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
      await depositNTransactions(
        nf3Instance,
        count % txPerBlock ? count % txPerBlock : txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );

      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    } else {
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    }

    count = await nf3Instance.unprocessedTransactionCount();
  }

  await depositNTransactions(
    nf3Instance,
    txPerBlock,
    erc20Address,
    tokenType,
    transferValue,
    tokenId,
    fee,
  );
  eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
};

describe('ERC20 tests', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer();
    await nf3Proposer.addPeer(environment.optimistApiUrl);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      if (process.env.VERBOSE)
        console.log(
          `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
            gasUsed / txPerBlock
          }`,
        );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await emptyL2(nf3Users[0]);
  });

  afterEach(async () => {
    await emptyL2(nf3Users[0]);
  });

  describe('Deposits', () => {
    it('should deposit some ERC20 crypto into a ZKP commitment', async function () {
      if (process.env.VERBOSE) console.log(`      Sending ${txPerBlock} deposits...`);
      // We create enough transactions to fill blocks full of deposits.
      const depositTransactions = await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // Wait until we see the right number of blocks appear
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);
      if (process.env.VERBOSE)
        console.log(`     Average Gas used was ${Math.ceil(totalGas / txPerBlock)}`);
    });

    it('should increment the balance after deposit some ERC20 crypto', async function () {
      const currentPkdBalance = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      // We do txPerBlock deposits of 10 each
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
      const afterPkdBalance = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      expect(afterPkdBalance - currentPkdBalance).to.be.equal(txPerBlock * transferValue);
    });
  });

  describe('Transfers', () => {
    it('should decrement the balance after transfer ERC20 to other wallet and increment the other wallet', async function () {
      let balances;
      async function getBalances() {
        balances = [
          (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0,
          (await nf3Users[1].getLayer2Balances())[erc20Address]?.[0].balance || 0,
        ];
      }

      await getBalances();
      const beforeBalances = JSON.parse(JSON.stringify(balances));

      for (let i = 0; i < txPerBlock; i++) {
        const res = await nf3Users[0].transfer(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3Users[1].zkpKeys.compressedPkd,
          fee,
        );
        expectTransaction(res);

        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      await getBalances();

      expect(balances[0] - beforeBalances[0]).to.be.equal(-txPerBlock * transferValue);
      expect(balances[1] - beforeBalances[1]).to.be.equal(txPerBlock * transferValue);
    });

    it('should transfer some ERC20 crypto (back to us) using ZKP', async function () {
      const before = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;

      for (let i = 0; i < txPerBlock; i++) {
        const res = await nf3Users[0].transfer(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3Users[0].zkpKeys.compressedPkd,
          fee,
        );
        expectTransaction(res);
        if (process.env.VERBOSE) console.log(`     Gas used was ${Number(res.gasUsed)}`);
      }
      const after = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;

      // stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      expect(after).to.be.lessThan(before);
    });

    it('should send a single ERC20 transfer directly to a proposer', async function () {
      const before = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;

      // here we don't need to emptyL2 because we're sending two transactions
      for (let i = 0; i < txPerBlock; i++) {
        const res = await nf3Users[0].transfer(
          true,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3Users[1].zkpKeys.compressedPkd,
          fee,
        );
        expect(res).to.be.equal(200);
      }

      const after = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      expect(after).to.be.lessThan(before);
    });

    it('should send a double ERC20 transfer directly to a proposer', async function () {
      // we get some different transferValue than the commitments we have (all should be of value transferValue)
      // then we send it, the client should pick two commitments to send the transaction
      const doubleTransferValue = Math.ceil(transferValue * 1.2);

      const before = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;

      // here we don't need to emptyL2 because we're sending two transactions
      for (let i = 0; i < txPerBlock; i++) {
        const res = await nf3Users[0].transfer(
          true,
          erc20Address,
          tokenType,
          doubleTransferValue,
          tokenId,
          nf3Users[1].zkpKeys.compressedPkd,
          fee,
        );
        expect(res).to.be.equal(200);
      }

      const after = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      expect(after).to.be.lessThan(before);
    });
  });

  describe('Normal withdraws from L2', () => {
    it('should withdraw from L2, checking for missing commitment', async function () {
      const beforeBalance = (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance;
      const rec = await nf3Users[0].withdraw(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].ethereumAddress,
      );
      expectTransaction(rec);

      if (process.env.VERBOSE) console.log(`     Gas used was ${Number(rec.gasUsed)}`);
      const afterBalance = (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance;
      expect(afterBalance).to.be.lessThan(beforeBalance);
    });

    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async function () {
      let error = null;
      try {
        const rec = await nf3Users[0].withdraw(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3Users[0].ethereumAddress,
        );
        expectTransaction(rec);
        const withdrawal = await nf3Users[0].getLatestWithdrawHash();
        await emptyL2(nf3Users[0]);
        const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
        expectTransaction(res);
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(
        message =>
          message.includes(
            'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw funds from this block',
          ) || message.includes('Transaction has been reverted by the EVM'),
      );
    });

    it('should withdraw from L2, checking for L1 balance (only with time-jump client)', async function () {
      const nodeInfo = await web3Client.getInfo();
      if (nodeInfo.includes('TestRPC')) {
        const startBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);

        const rec = await nf3Users[0].withdraw(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3Users[0].ethereumAddress,
        );
        expectTransaction(rec);
        const withdrawal = await nf3Users[0].getLatestWithdrawHash();

        await emptyL2(nf3Users[0]);

        await web3Client.timeJump(3600 * 24 * 10); // jump in time by 50 days

        const commitments = await nf3Users[0].getPendingWithdraws();
        expect(
          commitments[nf3Users[0].zkpKeys.compressedPkd][erc20Address].length,
        ).to.be.greaterThan(0);
        expect(
          commitments[nf3Users[0].zkpKeys.compressedPkd][erc20Address].filter(c => c.valid === true)
            .length,
        ).to.be.greaterThan(0);

        const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
        expectTransaction(res);

        const endBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);
        expect(parseInt(endBalance, 10)).to.be.lessThan(parseInt(startBalance, 10));
      } else {
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  describe('Instant withdrawals from L2', () => {
    const nf3LiquidityProvider = new Nf3(signingKeys.liquidityProvider, environment);
    before(async () => {
      await nf3LiquidityProvider.init(mnemonics.liquidityProvider);

      const txDataToSign = await approve(
        erc20Address,
        nf3LiquidityProvider.ethereumAddress,
        nf3LiquidityProvider.shieldContractAddress,
        tokenType,
        transferValue,
        web3Client.getWeb3(),
        !!nf3LiquidityProvider.ethereumSigningKey,
      );
      if (txDataToSign) {
        await nf3LiquidityProvider.submitTransaction(txDataToSign, erc20Address, 0);
      }

      // Liquidity provider for instant withdraws
      const emitter = await nf3Users[0].getInstantWithdrawalRequestedEmitter();
      emitter.on('data', async withdrawTransactionHash => {
        // approve tokens to be advanced by liquidity provider in the instant withdraw
        try {
          await nf3LiquidityProvider.advanceInstantWithdrawal(withdrawTransactionHash);
        } catch (e) {
          console.log('ERROR Liquidity Provider: ', e);
        }

        logs.instantWithdraw += 1;
      });

      web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    });

    it('should allow instant withdraw of existing withdraw', async function () {
      const startBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);

      await nf3Users[0].withdraw(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].ethereumAddress,
        fee,
      );
      const latestWithdrawTransactionHash = nf3Users[0].getLatestWithdrawHash();
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      const count = logs.instantWithdraw;

      await emptyL2(nf3Users[0]);
      // We request the instant withdraw and should wait for the liquidity provider to send the instant withdraw
      const res = await nf3Users[0].requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expectTransaction(res);
      if (process.env.VERBOSE) console.log(`     Gas used was ${Number(res.gasUsed)}`);

      await emptyL2(nf3Users[0]);

      await waitForTxExecution(count, 'instantWithdraw');

      const endBalance = await web3Client.getBalance(nf3Users[0].ethereumAddress);

      expect(parseInt(endBalance, 10)).to.be.lessThan(parseInt(startBalance, 10));
    });

    it('should not allow instant withdraw of non existing withdraw or not in block yet', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      await nf3Users[0].withdraw(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].ethereumAddress,
        fee,
      );
      const latestWithdrawTransactionHash = nf3Users[0].getLatestWithdrawHash();
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      const res = await nf3Users[0].requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expect(res).to.be.equal(null);
    });

    after(async () => {
      await emptyL2(nf3Users[0]);
      await nf3LiquidityProvider.close();
    });
  });

  /* 
    What is this, you wonder? We're just testing restrictions, since for an initial release phase
    we want to restrict the amount of deposits/withdraws. Take a look at #516 if you want to know more
    */
  describe('Restrictions', () => {
    describe('Testing new restrictions', async () => {
      let newAmount;
      before(() => {
        const defaultERC20restriction = defaultRestrictions.find(
          e => e.address.toLowerCase() === erc20Address,
        );

        newAmount = Math.ceil(
          Math.random() * (defaultERC20restriction.amount - transferValue) + transferValue,
        );
      });

      it('should restrict deposits', async () => {
        // anything equal or above the restricted amount should fail
        try {
          await depositNTransactions(
            nf3Users[0],
            txPerBlock,
            erc20Address,
            tokenType,
            newAmount,
            tokenId,
            fee,
          );
          expect.fail('Transaction has been reverted by the EVM');
        } catch (error) {
          expect(error.message).to.satisfy(message =>
            message.includes('Transaction has been reverted by the EVM'),
          );
        }
      });

      it('should restrict withdrawals', async () => {
        const nodeInfo = await web3Client.getInfo();
        if (nodeInfo.includes('TestRPC')) {
          try {
            // we need two transactions to serve as commitments to the withdrawal
            // but we can't deposit the whole amount because... that's the limit 😅
            // so let's just split it
            await depositNTransactions(
              nf3Users[0],
              txPerBlock,
              erc20Address,
              tokenType,
              Math.ceil(newAmount / txPerBlock),
              tokenId,
              fee,
            );

            // we also need a commitment of the specific amount we need to withdraw
            // so we should transfer that amount to ourselves
            await nf3Users[0].transfer(
              false,
              erc20Address,
              tokenType,
              newAmount,
              tokenId,
              nf3Users[0].zkpKeys.compressedPkd,
              fee,
            );

            await emptyL2(nf3Users[0]);

            const rec = await nf3Users[0].withdraw(
              false,
              erc20Address,
              tokenType,
              newAmount,
              tokenId,
              nf3Users[0].ethereumAddress,
              fee,
            );

            expectTransaction(rec);
            const withdrawal = await nf3Users[0].getLatestWithdrawHash();

            await emptyL2(nf3Users[0]);

            await web3Client.timeJump(3600 * 24 * 10); // jump in time by 50 days

            // anything equal or above the restricted amount should fail
            await nf3Users[0].finaliseWithdrawal(withdrawal);
            expect.fail('Transaction has been reverted by the EVM');
          } catch (error) {
            expect(error.message).to.satisfy(message =>
              message.includes('Transaction has been reverted by the EVM'),
            );
          }
        } else {
          console.log('     Not using a time-jump capable test client so this test is skipped');
          this.skip();
        }
      });
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
