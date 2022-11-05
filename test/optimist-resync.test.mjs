/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import compose from 'docker-compose';
import Transaction from '@polygon-nightfall/common-files/classes/transaction.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { depositNTransactions, Web3Client, waitForTimeout } from './utils.mjs';
import { buildBlockSolidityStruct } from '../nightfall-optimist/src/services/block-utils.mjs';

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

const { PROPOSE_BLOCK } = config.SIGNATURES;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];
let eventsSeen;
let minimumStake;

describe('Optimist synchronisation tests', () => {
  let blockProposeEmitter;
  let challengeEmitter;
  const options = {
    config: [
      'docker/docker-compose.yml',
      'docker/docker-compose.dev.yml',
      'docker/docker-compose.ganache.yml',
    ],
    log: process.env.LOG_LEVEL || 'silent',
    composeOptions: [['-p', 'nightfall_3']],
  };

  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Challenger.init(mnemonics.challenger);
    minimumStake = await nf3Proposer1.getMinimumStake();
    // we must set the URL from the point of view of the client container
    await nf3Proposer1.registerProposer('http://optimist', minimumStake);

    // Proposer listening for incoming events
    blockProposeEmitter = await nf3Proposer1.startProposer();
    challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter.on('receipt', (receipt, type) =>
      logger.debug(`challenge listener received challenge receipt of type ${type}`),
    );
    challengeEmitter.on('error', (err, type) =>
      logger.debug(`challenge listener received error ${err.message} of type ${type}`),
    );
    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('With and without a bad block', () => {
    // setup a listener for a block proposal
    const proposePromise = () =>
      new Promise(resolve =>
        blockProposeEmitter.on('receipt', (receipt, b, t) =>
          resolve({ receipt, block: b, transactions: t }),
        ),
      );
    // setup a listener for a block proposal
    const rollbackPromise = () =>
      new Promise(resolve =>
        challengeEmitter.on('rollback', () => {
          resolve();
        }),
      );

    // setup a healthcheck wait
    const healthy = async () => {
      while (!(await nf3Proposer1.healthcheck('optimist'))) {
        await waitForTimeout(1000);
      }

      logger.debug('optimist is healthy');
    };

    const dropOptimistMongoDatabase = async () => {
      logger.debug(`Dropping Optimist's Mongo database`);
      let mongoConn;
      try {
        mongoConn = await mongo.connection('mongodb://localhost:27017');

        while (!(await mongoConn.db('optimist_data').dropDatabase())) {
          logger.debug(`Retrying dropping MongoDB`);
          await waitForTimeout(2000);
        }

        logger.debug(`Optimist's Mongo database dropped successfuly!`);
      } finally {
        mongo.disconnect();
      }
    };

    const dropOptimistMongoBlocksCollection = async () => {
      logger.debug(`Dropping Optimist's Mongo collection`);
      let mongoConn;
      try {
        mongoConn = await mongo.connection('mongodb://localhost:27017');

        while (!(await mongoConn.db('optimist_data').collection('blocks').drop())) {
          logger.debug(`Retrying dropping MongoDB blocks colection`);
          await waitForTimeout(2000);
        }
        while (!(await mongoConn.db('optimist_data').collection('timber').drop())) {
          logger.debug(`Retrying dropping MongoDB timber colection`);
          await waitForTimeout(2000);
        }

        logger.debug(`Optimist's Mongo blocks dropped successfuly!`);
      } finally {
        mongo.disconnect();
      }
    };

    async function restartOptimist(dropDb = true) {
      await compose.stopOne('optimist', options);
      await compose.rm(options, 'optimist');

      // dropDb vs dropCollection.
      if (dropDb) {
        await dropOptimistMongoDatabase();
      } else {
        await dropOptimistMongoBlocksCollection();
      }

      await compose.upOne('optimist', options);

      await healthy();
    }

    it('Resync optimist after making a good block without dropping dB', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      let p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block } = await p;
      const firstBlock = { ...block };
      console.log('First Block', firstBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await waitForTimeout(5000);
      await restartOptimist(false);

      // we need to remind optimist which proposer it's connected to
      await nf3Proposer1.registerProposer('http://optimist', minimumStake);
      await waitForTimeout(5000);
      // TODO - get optimist to do this automatically.
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occured
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;
      console.log('Second block', secondBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Resync optimist after making a good block dropping Db', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      let p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block } = await p;
      const firstBlock = { ...block };
      console.log('First block', firstBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await restartOptimist();

      // we need to remind optimist which proposer it's connected to
      await nf3Proposer1.registerProposer('http://optimist', minimumStake);
      // TODO - get optimist to do this automatically.
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occured
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;
      console.log('Second block', secondBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Resync optimist after making an un-resolved bad block', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      let p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block, transactions } = await p;
      const firstBlock = { ...block };
      console.log('First block', firstBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // turn off challenging.  We're going to make a bad block and we don't want it challenged
      await nf3Challenger.challengeEnable(false);
      // update the block so we can submit it again
      // we'll do the easiest thing and submit it again with no change other than to increment
      // the L2 block number and block hash so that it doesn't get reverted straight away.
      // It will be a bad block because we'll have submitted the same transactions and leafcount
      // before.
      // To achieve that, we'll manually assemble and submit a new proposeBlock call
      // in the following lines...

      // retrieve the code for the 'proposeBlock' function. We'll check it every time rather than
      // hard code it, in case someone changes the function.
      const functionCode = (
        await web3Client.getWeb3().eth.getTransaction(eventsSeen[0].log.transactionHash)
      ).input.slice(0, 10);
      // fix up the blockHash and blockNumberL2 to prevent an immediate revert
      block.previousBlockHash = block.blockHash;
      block.blockNumberL2++;
      // now assemble our bad-block transaction; first the parameters
      const blockData = Object.values(buildBlockSolidityStruct(block));
      const transactionsData = Object.values(
        transactions.map(t => Object.values(Transaction.buildSolidityStruct(t))),
      );
      const encodedParams = web3Client
        .getWeb3()
        .eth.abi.encodeParameters(PROPOSE_BLOCK, [blockData, transactionsData]);
      // then the function identifier is added
      const newTx = `${functionCode}${encodedParams.slice(2)}`;
      // then send it!
      logger.debug('Resubmitting the same transactions in the next block');
      await web3Client.submitTransaction(newTx, signingKeys.proposer1, stateAddress, 8000000, 1);
      logger.debug('bad block submitted');
      const r = rollbackPromise();
      // Now we have a bad block, let's force Optimist to re-sync by turning it off and on again!
      await restartOptimist();

      logger.debug('waiting for rollback to complete');
      await r;
      logger.debug('rollback complete event received');
      // the rollback will have removed us as proposer. We need to re-register because we
      // were the only proposer in town!
      await nf3Proposer1.registerProposer('http://optimist', minimumStake);
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a rollback correctly occured
      logger.debug(`      Sending ${txPerBlock} deposits...`);
      p = proposePromise();
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;
      console.log('Second block', secondBlock);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Challenger.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
