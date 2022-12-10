/* eslint-disable no-await-in-loop */
import axios from 'axios';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  expectTransaction,
  getLayer2Balances,
  waitTransactionToBeMined,
  Web3Client,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

axios.defaults.headers.common['X-APP-TOKEN'] = environment.AUTH_TOKEN;

const web3Client = new Web3Client();
const web3 = web3Client.getWeb3();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const { optimistApiUrl } = environment;

let erc20Address;
async function makeDeposit(value, fee = 0) {
  logger.debug(`Make deposit of ${value}...`);
  return nf3User.deposit(erc20Address, tokenType, value, tokenId, fee);
}

async function makeBlock() {
  logger.debug(`Make block...`);
  await axios.get(`${optimistApiUrl}/block/make-now`);
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('General Circuit Test', function () {
  let stateAddress;
  const proposerFee = '0';
  const proposerStake = '1000000';
  const LAST_TEST_FINAL_BALANCES = 'Should expect finalBalance to be initialBalance, ie 0';

  before(async function () {
    // Create and initialise user
    await nf3User.init(mnemonics.user1);

    // Register proposer, wait for transaction to be mined
    const { data } = await axios.post(`${optimistApiUrl}/proposer/register`, {
      url: optimistApiUrl,
      stake: proposerStake,
      fee: proposerFee,
    });
    await waitTransactionToBeMined(data.transactionHash, web3);

    // Get contract addresses, subscribe to events
    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Test that all circuits are working without fees', function () {
    const noFee = 0;
    let value = 10;

    let initialBalance;
    let finalBalance;

    before(async function () {
      initialBalance = await getLayer2Balances(nf3User, erc20Address);
    });

    it('Should deposit', async function () {
      const deposit = await makeDeposit(value);
      expectTransaction(deposit);
      logger.debug(`Gas used was ${Number(deposit.gasUsed)}`);
    });

    // l2Balance: 10
    it(`Should transfer ${value}, ie single transfer with no change`, async function () {
      const singleTransferNoChange = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        noFee,
      );
      expectTransaction(singleTransferNoChange);
      logger.debug(`Gas used was ${Number(singleTransferNoChange.gasUsed)}`);
    });

    // l2Balance: 10
    it(`Should transfer ${value}, ie single transfer with change`, async function () {
      value = 5;
      const singleTransferChange = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        noFee,
      );
      expectTransaction(singleTransferChange);
      logger.debug(`Gas used was ${Number(singleTransferChange.gasUsed)}`);
    });

    // l2Balance: 5 + 5
    it(`Should withdraw ${value}, ie single withdrawal with no change`, async function () {
      const withdrawalNoChange = await nf3User.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.ethereumAddress,
        noFee,
      );
      expectTransaction(withdrawalNoChange);
      logger.debug(`Gas used was ${Number(withdrawalNoChange.gasUsed)}`);
    });

    // l2Balance: 5
    it(`Should withdraw ${value}, ie single withdrawal with change`, async function () {
      value = 2;
      const withdrawalChange = await nf3User.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.ethereumAddress,
        noFee,
      );
      expectTransaction(withdrawalChange);
      logger.debug(`Gas used was ${Number(withdrawalChange.gasUsed)}`);
    });

    // l2Balance: 3 + 8
    it(`Should transfer ${value}, ie double transfer with change`, async function () {
      // Arrange
      value = 8;
      await makeDeposit(value);
      await makeBlock();

      // Act, assert
      value = 9;
      const doubleTransferChange = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        noFee,
      );
      expectTransaction(doubleTransferChange);
      logger.debug(`Gas used was ${Number(doubleTransferChange.gasUsed)}`);
    });

    // l2Balance: 9 + 2
    it(`Should transfer ${value}, ie double transfer with no change`, async function () {
      value = 11;
      const doubleTransferNoChange = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        noFee,
      );
      expectTransaction(doubleTransferNoChange);
      logger.debug(`Gas used was ${Number(doubleTransferNoChange.gasUsed)}`);
    });

    // l2Balance: 11 + 4
    it(`Should withdraw ${value}, ie double withdrawal with change`, async function () {
      // Arrange
      value = 4;
      await makeDeposit(value);
      await makeBlock();

      // Act, assert
      value = 12;
      const doubleWithdrawalChange = await nf3User.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.ethereumAddress,
        noFee,
      );
      expectTransaction(doubleWithdrawalChange);
      logger.debug(`Gas used was ${Number(doubleWithdrawalChange.gasUsed)}`);
    });

    // l2Balance: 3 + 2
    it(`Should withdraw ${value}, ie double withdrawal with no change`, async function () {
      // Arrange
      value = 2;
      await makeDeposit(value);
      await makeBlock();

      // Act, assert
      value = 5;
      const doubleWithdrawalNoChange = await nf3User.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User.ethereumAddress,
        noFee,
      );
      expectTransaction(doubleWithdrawalNoChange);
      logger.debug(`Gas used was ${Number(doubleWithdrawalNoChange.gasUsed)}`);
    });

    it(LAST_TEST_FINAL_BALANCES, async function () {
      finalBalance = await getLayer2Balances(nf3User, erc20Address);
      expect(finalBalance - initialBalance).to.be.equal(0);
    });

    afterEach(async function () {
      if (this.currentTest.title === LAST_TEST_FINAL_BALANCES) return;
      await makeBlock();
    });
  });

  after(async function () {
    await axios.post(`${optimistApiUrl}/proposer/de-register`);
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
