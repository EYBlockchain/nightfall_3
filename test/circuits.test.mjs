/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { expectTransaction, waitTransactionToBeMined, Web3Client } from './utils.mjs';

// chai configs
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

const { optimistApiUrl } = environment;

const web3Client = new Web3Client();
const web3 = web3Client.getWeb3();

describe('General Circuit Test', () => {
  const proposerFee = '0';
  const proposerStake = '1000000';

  const eventLogs = [];

  let nf3User;
  let erc20Address;
  let stateAddress;

  async function getBalance() {
    logger.debug(`Get user balance...`);
    return (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;
  }

  async function makeDeposit(value, fee = 0) {
    logger.debug(`Make deposit of ${value}...`);
    await nf3User.deposit(erc20Address, tokenType, value, tokenId, fee);
  }

  async function makeBlock() {
    logger.debug(`Make block...`);
    await axios.get(`${this.optimistBaseUrl}/block/make-now`);
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
  }

  before(async () => {
    // Create and initialise user
    nf3User = new Nf3(signingKeys.user1, environment);
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

  it('Test that all circuits are working without fees', async () => {
    const initialBalance = await getBalance();
    let finalBalance;

    const noFee = 0;
    let value = 10;

    await makeDeposit(value);
    await makeBlock();

    // l2Balance: 10
    logger.debug(`Transfer ${value}, ie single transfer with no change`);
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

    await makeBlock();

    value = 5;

    // l2Balance: 10
    logger.debug(`Transfer ${value}, ie single transfer with change`);
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

    await makeBlock();

    // l2Balance: 5 + 5
    logger.debug(`Withdraw ${value}, ie single withdrawal with no change`);
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

    await makeBlock();

    value = 2;

    // l2Balance: 5
    logger.debug(`Withdraw ${value}, ie single withdrawal with change`);
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

    await makeBlock();

    value = 8;
    await makeDeposit(value);
    await makeBlock();

    value = 9;

    // l2Balance: 3 + 8
    logger.debug(`Transfer ${value}, ie double transfer with change`);
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

    await makeBlock();

    value = 11;

    // l2Balance: 9 + 2
    logger.debug(`Transfer ${value}, ie double transfer with no change`);
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

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    await axios.get(`${this.optimistBaseUrl}/block/make-now`);

    value = 4;
    await makeDeposit(value);
    await makeBlock();

    value = 12;

    // l2Balance: 11 + 4
    logger.debug(`Withdraw ${value}, ie double withdrawal with change`);

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

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    await axios.get(`${this.optimistBaseUrl}/block/make-now`);

    value = 2;
    await makeDeposit(value);
    await makeBlock();

    value = 5;

    // l2Balance: 3 + 2
    logger.debug(`Withdraw ${value}, ie double withdrawal with no change`);
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

    await makeBlock();

    logger.debug(`Expect finalBalance ${finalBalance} - initialBalance ${initialBalance} to be 0`);
    finalBalance = await getBalance();
    expect(finalBalance - initialBalance).to.be.equal(0);
  });

  after(async () => {
    await axios.post(`${optimistApiUrl}/proposer/de-register`);
    await web3Client.closeWeb3();
  });
});
