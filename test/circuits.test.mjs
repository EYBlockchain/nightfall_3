/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { expectTransaction, Web3Client } from './utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  MINIMUM_STAKE,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];

/*
  This function tries to zero the number of unprocessed transactions in the optimist node
  that nf3 is connected to. We call it extensively on the tests, as we want to query stuff from the
  L2 layer, which is dependent on a block being made. We also need 0 unprocessed transactions by the end
  of the tests, otherwise the optimist will become out of sync with the L2 block count on-chain.
*/
describe('General Circuit Test', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    // we must set the URL from the point of view of the client container
    await nf3Proposer.registerProposer('http://optimist1', MINIMUM_STAKE);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await nf3Users[0].makeBlockNow();
  });

  it.skip('Test that matic transfers pays the fee from the same transfer commitment', async () => {
    async function getBalance() {
      return Promise.all([
        (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0,
        (await nf3Users[1].getLayer2Balances())[erc20Address]?.[0].balance || 0,
      ]);
    }
    logger.debug(`Sending 1 deposit of 10...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 10, tokenId, 0);

    await nf3Users[0].makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    const beforeBalances = await getBalance();

    const singleTransfer = await nf3Users[0].transfer(
      false,
      erc20Address,
      tokenType,
      7,
      tokenId,
      nf3Users[1].zkpKeys.compressedZkpPublicKey,
      1,
    );
    expectTransaction(singleTransfer);

    await nf3Users[0].makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    const afterBalances = await getBalance();

    expect(afterBalances[0] - beforeBalances[0]).to.be.equal(-8);
    expect(afterBalances[1] - beforeBalances[1]).to.be.equal(7);
  });

  it('Test that all circuits are working without fees', async () => {
    async function getBalance() {
      return (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;
    }

    const initialBalance = await getBalance();

    logger.debug(`Sending 1 deposit of 10...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 10, tokenId, 0);

    await nf3Users[0].makeBlockNow();

    // Wait until we see the right number of blocks appear
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    // Deposit checks here

    logger.debug(`Sending single transfer with no change...`);
    const singleTransferNoChange = await nf3Users[0].transfer(
      false,
      erc20Address,
      tokenType,
      10,
      tokenId,
      nf3Users[0].zkpKeys.compressedZkpPublicKey,
      0,
    );
    expectTransaction(singleTransferNoChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    // Single Transfer No Change checks here

    logger.debug(`Sending single transfer with change...`);
    const singleTransferChange = await nf3Users[0].transfer(
      false,
      erc20Address,
      tokenType,
      5,
      tokenId,
      nf3Users[0].zkpKeys.compressedZkpPublicKey,
      0,
    );
    expectTransaction(singleTransferChange);

    await nf3Users[0].makeBlockNow();

    ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));

    logger.debug(`Sending withdrawal with no change...`);
    const withdrawalNoChange = await nf3Users[0].withdraw(
      false,
      erc20Address,
      tokenType,
      5,
      tokenId,
      nf3Users[0].ethereumAddress,
      0,
    );

    expectTransaction(withdrawalNoChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Withdrawal No Change checks here

    logger.debug(`Sending withdrawal with change...`);
    const withdrawalChange = await nf3Users[0].withdraw(
      false,
      erc20Address,
      tokenType,
      2,
      tokenId,
      nf3Users[0].ethereumAddress,
      0,
    );

    expectTransaction(withdrawalChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Withdrawal Change checks here

    logger.debug(`Sending deposit of 8...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 8, tokenId, 0);
    await nf3Users[0].makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    logger.debug(`Sending double transfer with change...`);
    const doubleTransferChange = await nf3Users[0].transfer(
      false,
      erc20Address,
      tokenType,
      9,
      tokenId,
      nf3Users[0].zkpKeys.compressedZkpPublicKey,
      0,
    );

    expectTransaction(doubleTransferChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Double transfer Change checks here

    logger.debug(`Sending double transfer with no change...`);
    const doubleTransferNoChange = await nf3Users[0].transfer(
      false,
      erc20Address,
      tokenType,
      11,
      tokenId,
      nf3Users[0].zkpKeys.compressedZkpPublicKey,
      0,
    );

    expectTransaction(doubleTransferNoChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Double transfer No Change checks here

    logger.debug(`Sending deposit of 4...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 4, tokenId, 0);

    await nf3Users[0].makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    logger.debug(`Sending double withdrawal with change...`);
    const doubleWithdrawalChange = await nf3Users[0].withdraw(
      false,
      erc20Address,
      tokenType,
      12,
      tokenId,
      nf3Users[0].ethereumAddress,
      0,
    );

    expectTransaction(doubleWithdrawalChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Double Withdrawal Change checks here

    logger.debug(`Sending deposit of 2...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 2, tokenId, 0);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    logger.debug(`Sending double Withdrawal with no change...`);
    const doubleWithdrawalNoChange = await nf3Users[0].withdraw(
      false,
      erc20Address,
      tokenType,
      5,
      tokenId,
      nf3Users[0].ethereumAddress,
      0,
    );

    expectTransaction(doubleWithdrawalNoChange);

    await nf3Users[0].makeBlockNow();

    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    // Double Withdrawal No Change

    const finalBalance = await getBalance();
    expect(finalBalance - initialBalance).to.be.equal(0);
  });
});
