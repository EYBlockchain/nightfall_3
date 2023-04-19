/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import {
  expectTransaction,
  Web3Client,
  getLayer2Balances,
  getUserCommitments,
} from '../../utils.mjs';
import { getERCInfo } from '../../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const { generalise } = gen;

const {
  fee,
  transferValue,
  tokenConfigs: { tokenTypeERC1155, tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const web3 = web3Client.getWeb3();
const eventLogs = [];
let rollbackCount = 0;

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3User2 = new Nf3(signingKeys.user2, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

let _tokenId;

let erc1155Address;
async function getLayer2Erc1155Balance(_nf3User) {
  return (
    (await _nf3User.getLayer2Balances())[erc1155Address]?.find(
      e => e.tokenId === generalise(_tokenId).hex(32),
    )?.balance || 0
  );
}

async function makeBlock() {
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('ERC1155 tests', () => {
  let erc20Address;
  let stateAddress;
  let availableTokenIds;

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
    erc1155Address = await nf3User.getContractAddress('ERC1155Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    availableTokenIds = (
      await getERCInfo(erc1155Address, nf3User.ethereumAddress, web3, {
        details: true,
      })
    ).details.map(t => t.tokenId);

    // eslint-disable-next-line prefer-destructuring
    _tokenId = availableTokenIds[1];

    await nf3User.deposit(erc20Address, tokenType, 10 * transferValue, tokenId, 0);

    await makeBlock();

    await nf3User.deposit(erc1155Address, tokenTypeERC1155, 50 * transferValue, _tokenId, fee);

    await makeBlock();
  });

  describe('Deposits', () => {
    it('Should increment user L2 balance after depositing some ERC1155', async function () {
      const userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User);
      const userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      const res = await nf3User.deposit(
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        fee,
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
    });
  });

  describe('Transfer', () => {
    it('Should decrement user L2 balance after transferring some ERC721 to other wallet, and increment the other wallet balance', async function () {
      const userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const res = await nf3User.transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      // Assertions user
      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(-transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
      // user 2
      expect(user2L2Erc1155BeforeAfter - user2L2Erc1155BeforeBalance).to.be.equal(transferValue);
    });

    it('should perform a transfer by specifying the commitment that provides enough value to cover value + fee', async function () {
      const userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      const erc20Commitments = userCommitments
        .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
        .filter(c => c.value >= generalise(fee).hex(32));

      const erc1155Commitments = userCommitments.filter(
        c =>
          c.ercAddress === generalise(erc1155Address).hex(32) &&
          c.tokenId === generalise(_tokenId).hex(32),
      );

      const res = await nf3User.transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
        [erc1155Commitments[0].commitmentHash],
        [erc20Commitments[0].commitmentHash],
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      // Assertions user
      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(-transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
      // user 2
      expect(user2L2Erc1155BeforeAfter - user2L2Erc1155BeforeBalance).to.be.equal(transferValue);
    });

    it('should perform a transfer by specifying the commitment that provides enough value to cover value', async function () {
      const userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      const erc1155Commitments = userCommitments.filter(
        c =>
          c.ercAddress === generalise(erc1155Address).hex(32) &&
          c.tokenId === generalise(_tokenId).hex(32),
      );

      const res = await nf3User.transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
        [erc1155Commitments[0].commitmentHash],
        [],
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      // Assertions user
      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(-transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
      // user 2
      expect(user2L2Erc1155BeforeAfter - user2L2Erc1155BeforeBalance).to.be.equal(transferValue);
    });

    it('should perform a transfer by specifying the commitment that provides enough value to fee', async function () {
      const userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      const erc20Commitments = userCommitments
        .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
        .filter(c => c.value >= generalise(fee).hex(32));

      const res = await nf3User.transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
        [],
        [erc20Commitments[0].commitmentHash],
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const user2L2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User2);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      // Assertions user
      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(-transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
      // user 2
      expect(user2L2Erc1155BeforeAfter - user2L2Erc1155BeforeBalance).to.be.equal(transferValue);
    });

    it('should fail to perform a transfer if user specifies commitments for the value but it does not cover the whole value', async function () {
      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      const erc1155Commitments = userCommitments.filter(
        c =>
          c.ercAddress === generalise(erc1155Address).hex(32) &&
          c.tokenId === generalise(_tokenId).hex(32),
      );

      try {
        await nf3User.transfer(
          false,
          erc1155Address,
          tokenTypeERC1155,
          Number(generalise(erc1155Commitments[0].value).bigInt + 1n),
          _tokenId,
          nf3User2.zkpKeys.compressedZkpPublicKey,
          fee,
          [erc1155Commitments[0].commitmentHash],
          [],
        );
      } catch (err) {
        expect(err.response.data).to.be.equal('provided commitments do not cover the value');
      }
    });

    it('should fail to perform a transfer if user specifies commitments for the fee but it does not cover the whole value', async function () {
      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      const erc20Commitments = userCommitments
        .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
        .filter(c => c.value >= generalise(fee).hex(32));

      try {
        await nf3User.transfer(
          false,
          erc1155Address,
          tokenTypeERC1155,
          transferValue,
          availableTokenIds[1],
          nf3User2.zkpKeys.compressedZkpPublicKey,
          Number(generalise(erc20Commitments[0].value).bigInt + 1n),
          [],
          [erc20Commitments[0].commitmentHash],
        );
      } catch (err) {
        expect(err.response.data).to.be.equal('provided commitments do not cover the fee');
      }
    });
  });

  describe('Withdrawals', () => {
    let userL2Erc1155BeforeBalance;
    let userL2FeesBalanceBefore;
    let withdrawalTx;
    let withdrawalTxHash;

    before(async function () {
      _tokenId = availableTokenIds.shift();
      await nf3User.deposit(erc1155Address, tokenTypeERC1155, transferValue, _tokenId, fee);
      await makeBlock();

      userL2Erc1155BeforeBalance = await getLayer2Erc1155Balance(nf3User, _tokenId);
      userL2FeesBalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      withdrawalTx = await nf3User.withdraw(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        _tokenId,
        nf3User.ethereumAddress,
        fee,
      );
      withdrawalTxHash = nf3User.getLatestWithdrawHash();
    });

    it('Should withdraw from L2', async function () {
      expectTransaction(withdrawalTx);
      logger.debug(`Gas used was ${Number(withdrawalTx.gasUsed)}`);
      await makeBlock();

      const userL2Erc1155BeforeAfter = await getLayer2Erc1155Balance(nf3User);
      const userL2FeesBalanceAfter = await getLayer2Balances(nf3User, erc20Address);

      expect(userL2Erc1155BeforeAfter - userL2Erc1155BeforeBalance).to.be.equal(-transferValue);
      expect(userL2FeesBalanceAfter - userL2FeesBalanceBefore).to.be.equal(-fee);
    });

    it('Should finalise previous withdrawal from L2 to L1 (only with time-jump client)', async function () {
      const nodeInfo = await web3Client.getInfo();
      if (!nodeInfo.includes('TestRPC')) {
        logger.info('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }

      const userL1BalanceBefore = await web3Client.getBalance(nf3User.ethereumAddress);

      await web3Client.timeJump(3600 * 24 * 10);
      const res = await nf3User.finaliseWithdrawal(withdrawalTxHash);
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);

      const userL1BalanceAfter = await web3Client.getBalance(nf3User.ethereumAddress);
      // Final L1 balance to be lesser than initial balance because of fees
      expect(parseInt(userL1BalanceAfter, 10)).to.be.lessThan(parseInt(userL1BalanceBefore, 10));
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
    web3Client.closeWeb3();
  });
});
