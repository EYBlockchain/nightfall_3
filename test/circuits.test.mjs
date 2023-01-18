/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { emptyL2, expectTransaction, Web3Client } from './utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[config.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];

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
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    await nf3Proposer.startProposer();

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  it('Test that all circuits are working without fees', async () => {
    async function getBalance() {
      return (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance || 0;
    }

    const initialBalance = await getBalance();

    logger.debug(`Sending 1 deposit of 10...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 10, tokenId, 0);

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

    // Withdrawal Change checks here

    logger.debug(`Sending deposit of 8...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 8, tokenId, 0);
    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

    // Double transfer No Change checks here

    logger.debug(`Sending deposit of 4...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 4, tokenId, 0);

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });
    // Double Withdrawal Change checks here

    logger.debug(`Sending deposit of 2...`);
    await nf3Users[0].deposit(erc20Address, tokenType, 2, tokenId, 0);

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

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

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

    // Double Withdrawal No Change

    const finalBalance = await getBalance();
    expect(finalBalance - initialBalance).to.be.equal(0);
  });
});
