import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { createRequire } from 'module';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForEvent, expectTransaction, depositNTransactions, Web3Client } from '../utils.mjs';

import { getERCInfo, approve } from '../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { web3WsUrl, network } = process.env;

// we need require here to import jsons
const environments = require('./environments.json');
const mnemonics = require('./mnemonics.json');
const signingKeys = require('./signingKeys.json');
const { fee, transferValue, txPerBlock } = require('./configs.json');
const { tokenType, tokenId } = require('./tokenConfigs.json');

const environment = environments[network];
const nf3Users = [
  new Nf3(web3WsUrl, signingKeys.user1, environment),
  new Nf3(web3WsUrl, signingKeys.user2, environment),
];
const nf3Proposer1 = new Nf3(web3WsUrl, signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];
const logCounts = {
  instantWithdraw: 0,
};
const waitForTxExecution = async (count, txType) => {
  while (count === logCounts[txType]) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};

const evenTheBlock = async nf3Instance => {
  let count = await nf3Instance.unprocessedTransactionCount();
  while (count !== 0) {
    if (count % txPerBlock) {
      // eslint-disable-next-line no-await-in-loop
      await depositNTransactions(
        nf3Instance,
        count % txPerBlock ? count % txPerBlock : txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // eslint-disable-next-line no-await-in-loop
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    } else {
      // eslint-disable-next-line no-await-in-loop
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    }
    // eslint-disable-next-line no-await-in-loop
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
  eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
};

describe('ERC20 tests', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();
    await nf3Proposer1.addPeer(environment.optimistApiUrl);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      if (process.env.GAS_COSTS)
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

    await evenTheBlock(nf3Users[0]);
  });

  afterEach(async () => {
    await evenTheBlock(nf3Users[0]);
  });

  describe('Deposits', () => {
    it('should deposit some ERC20 crypto into a ZKP commitment', async function () {
      console.log(`      Sending ${txPerBlock} deposits...`);
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
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);
      if (process.env.GAS_COSTS)
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
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
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
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      await getBalances();

      expect(balances[0] - beforeBalances[0]).to.be.equal(-txPerBlock * transferValue);
      expect(balances[1] - beforeBalances[1]).to.be.equal(txPerBlock * transferValue);
    });

    it('should transfer some ERC20 crypto (back to us) using ZKP', async function () {
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
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
        if (process.env.GAS_COSTS) console.log(`     Gas used was ${Number(res.gasUsed)}`);
      }
      // stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should send a single ERC20 transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive that transfer', async function () {
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
      // stateBalance += fee;
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
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

      if (process.env.GAS_COSTS) console.log(`     Gas used was ${Number(rec.gasUsed)}`);
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

        await evenTheBlock(nf3Users[0]);

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

        await evenTheBlock(nf3Users[0]);

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
    const nf3LiquidityProvider = new Nf3(web3WsUrl, signingKeys.liquidityProvider, environment);
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

        logCounts.instantWithdraw += 1;
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

      const count = logCounts.instantWithdraw;

      await evenTheBlock(nf3Users[0]);
      // We request the instant withdraw and should wait for the liquidity provider to send the instant withdraw
      const res = await nf3Users[0].requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expectTransaction(res);
      if (process.env.GAS_COSTS) console.log(`     Gas used was ${Number(res.gasUsed)}`);

      await evenTheBlock(nf3Users[0]);

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
      await evenTheBlock(nf3Users[0]);
      await nf3LiquidityProvider.close();
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
