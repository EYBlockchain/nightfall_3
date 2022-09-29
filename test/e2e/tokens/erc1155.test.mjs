/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import { generalise } from 'general-number';
import Nf3 from '../../../cli/lib/nf3.mjs';
import logger from '../../../common-files/utils/logger.mjs';
import { expectTransaction, Web3Client } from '../../utils.mjs';
import { getERCInfo } from '../../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  txPerBlock,
  transferValue,
  tokenConfigs: { tokenTypeERC1155, tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc1155Address;
// why do we need an ERC20 token in an ERC1155 test, you ask?
// let me tell you I also don't know, but I guess we just want to fill some blocks?
let erc20Address;
let stateAddress;
const eventLogs = [];
let availableTokenIds;

const emptyL2 = async () => {
  let count = await nf3Users[0].unprocessedTransactionCount();
  logger.debug(`count: ${count}`);

  while (count !== 0) {
    await nf3Users[0].makeBlockNow();
    // await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    count = await nf3Users[0].unprocessedTransactionCount();
    logger.debug(`L2 count: ${count}`);
  }

  await nf3Users[0].makeBlockNow();
  logger.debug('made new block');
  // await web3Client.waitForEvent(eventLogs, ['blockProposed']);
};

describe('ERC1155 tests', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();

    logger.debug('registered proposer');
    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
    erc1155Address = await nf3Users[0].getContractAddress('ERC1155Mock');
    logger.debug('initialized users');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    const availableTokens = (
      await getERCInfo(erc1155Address, nf3Users[0].ethereumAddress, web3Client.getWeb3(), {
        details: true,
      })
    ).details;

    availableTokenIds = availableTokens.map(t => t.tokenId);
    logger.debug('got available tokens');

    await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, 0);
    logger.debug('deposited');

    await emptyL2();
    logger.debug('emptied L2');
  });

  describe('Deposit', () => {
    it('should deposit some ERC1155 crypto into a ZKP commitment', async function () {
      const tokenToDeposit = availableTokenIds.shift();

      const beforeBalance =
        (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
          e => e.tokenId === generalise(tokenToDeposit).hex(32),
        )?.balance || 0;

      // We create enough transactions to fill blocks full of deposits.
      const res = await nf3Users[0].deposit(
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        tokenToDeposit,
        fee,
      );
      expectTransaction(res);

      await emptyL2();

      const afterBalance =
        (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
          e => e.tokenId === generalise(tokenToDeposit).hex(32),
        )?.balance || 0;

      expect(afterBalance - beforeBalance).to.be.equal(transferValue);
    });
  });

  describe('Transfer', () => {
    it('should decrement the balance after transfer ERC1155 to other wallet and increment the other wallet', async function () {
      const tokenToTransfer = availableTokenIds.shift();

      async function getBalances() {
        return Promise.all([
          (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
            e => e.tokenId === generalise(tokenToTransfer).hex(32),
          )?.balance || 0,
          (await nf3Users[1].getLayer2Balances())[erc1155Address]?.find(
            e => e.tokenId === generalise(tokenToTransfer).hex(32),
          )?.balance || 0,
          (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0,
        ]);
      }

      await nf3Users[0].deposit(
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        tokenToTransfer,
        fee,
      );

      await emptyL2();

      const beforeBalances = await getBalances();

      const res = await nf3Users[0].transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        tokenToTransfer,
        nf3Users[1].zkpKeys.compressedZkpPublicKey,
        fee,
      );
      expectTransaction(res);

      await emptyL2();

      const afterBalances = await getBalances();

      expect(afterBalances[0] - beforeBalances[0]).to.be.equal(-transferValue);
      expect(afterBalances[1] - beforeBalances[1]).to.be.equal(transferValue);
      expect(afterBalances[2] - beforeBalances[2]).to.be.equal(-fee);
    });
  });

  describe('Withdraw', () => {
    it('should withdraw from L2, checking for missing commitment', async function () {
      const tokenToWithdraw = availableTokenIds.shift();

      await nf3Users[0].deposit(
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        tokenToWithdraw,
        fee,
      );

      await emptyL2();

      const beforeBalanceERC1155 = (await nf3Users[0].getLayer2Balances())[erc1155Address].find(
        e => e.tokenId === generalise(tokenToWithdraw).hex(32),
      ).balance;
      const beforeBalanceERC20 =
        (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;

      const rec = await nf3Users[0].withdraw(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        tokenToWithdraw,
        nf3Users[0].ethereumAddress,
        fee,
      );

      await emptyL2();

      expectTransaction(rec);
      logger.debug(`Gas used was ${Number(rec.gasUsed)}`);

      const afterBalanceERC1155 =
        (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
          e => e.tokenId === generalise(tokenToWithdraw).hex(32),
        )?.balance || 0;

      const afterBalanceERC20 =
        (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;

      expect(afterBalanceERC1155 - beforeBalanceERC1155).to.be.equal(-transferValue);
      expect(afterBalanceERC20 - beforeBalanceERC20).to.be.equal(-fee);
    });

    it('should withdraw from L2, checking for L1 balance (only with time-jump client)', async function () {
      const nodeInfo = await web3Client.getInfo();
      if (nodeInfo.includes('TestRPC')) {
        const tokenToWithdraw = availableTokenIds.shift();

        await nf3Users[0].deposit(
          erc1155Address,
          tokenTypeERC1155,
          transferValue,
          tokenToWithdraw,
          fee,
        );

        await emptyL2();

        const beforeBalanceERC1155 =
          (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
            e => e.tokenId === generalise(tokenToWithdraw).hex(32),
          )?.balance || 0;

        const beforeBalanceERC20 =
          (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;

        const rec = await nf3Users[0].withdraw(
          false,
          erc1155Address,
          tokenTypeERC1155,
          transferValue,
          tokenToWithdraw,
          nf3Users[0].ethereumAddress,
          fee,
        );
        expectTransaction(rec);
        await emptyL2();

        const withdrawal = nf3Users[0].getLatestWithdrawHash();

        await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days

        const commitments = await nf3Users[0].getPendingWithdraws();

        expect(
          commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc1155Address].length,
        ).to.be.greaterThan(0);
        expect(
          commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc1155Address].filter(
            c => c.valid === true,
          ).length,
        ).to.be.greaterThan(0);

        const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
        expectTransaction(res);

        const afterBalanceERC1155 =
          (await nf3Users[0].getLayer2Balances())[erc1155Address]?.find(
            e => e.tokenId === generalise(tokenToWithdraw).hex(32),
          )?.balance || 0;

        const afterBalanceERC20 =
          (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;
        expect(afterBalanceERC1155 - beforeBalanceERC1155).to.be.equal(-transferValue);
        expect(afterBalanceERC20 - beforeBalanceERC20).to.be.equal(-fee);
      } else {
        logger.info('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    nf3Proposer1.close();
    nf3Users[0].close();
    nf3Users[1].close();
    web3Client.closeWeb3();
  });
});
