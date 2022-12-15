/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import compose from 'docker-compose';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
// import { buildBlockSolidityStruct } from '../common-files/utils/block-utils.mjs';
// import Transaction from '../common-files/classes/transaction.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { Web3Client, waitForTimeout } from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;
// const { PROPOSE_BLOCK } = config.SIGNATURES;
const { MONGO_URL, OPTIMIST_DB } = config;

const web3Client = new Web3Client();
// const web3 = web3Client.getWeb3();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
nf3Proposer.setApiKey(environment.AUTH_TOKEN);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);

const connection = await mongo.connection(MONGO_URL);
const db = connection.db(OPTIMIST_DB);

async function makeBlock() {
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

async function getLatestBlock() {
  const latestBlock = await db
    .collection('blocks')
    .find()
    .sort({ blockNumberL2: -1 })
    .limit(1)
    .toArray();
  return latestBlock[0];
}

describe('Optimist synchronisation tests', () => {
  let erc20Address;
  let stateAddress;
  // let eventsSeen;

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
    await nf3User.init(mnemonics.user1);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    await nf3Challenger.init(mnemonics.challenger);

    challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter.on('receipt', (receipt, type) =>
      logger.debug(`challenge listener received challenge receipt of type ${type}`),
    );
    challengeEmitter.on('error', (err, type) =>
      logger.debug(`challenge listener received error ${err.message} of type ${type}`),
    );

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('With and without a bad block', () => {
    // setup a listener for rollbacks
    // const rollbackPromise = () =>
    //   new Promise(resolve =>
    //     challengeEmitter.on('rollback', () => {
    //       resolve();
    //     }),
    //   );

    // setup a healthcheck wait
    const healthy = async () => {
      while (!(await nf3Proposer.healthcheck('optimist'))) {
        await waitForTimeout(1000);
      }

      logger.debug('optimist is healthy');
    };

    const dropOptimistMongoDatabase = async () => {
      logger.debug(`Dropping Optimist's Mongo database`);

      while (!(await db.dropDatabase())) {
        logger.debug(`Retrying dropping MongoDB`);
        await waitForTimeout(2000);
      }

      logger.debug(`Optimist's Mongo database dropped successfully!`);
    };

    const dropOptimistMongoBlocksCollection = async () => {
      logger.debug(`Dropping Optimist's Mongo collection`);

      while (!(await db.collection('blocks').drop())) {
        logger.debug(`Retrying dropping MongoDB blocks collection`);
        await waitForTimeout(2000);
      }
      while (!(await db.collection('timber').drop())) {
        logger.debug(`Retrying dropping MongoDB timber collection`);
        await waitForTimeout(2000);
      }

      logger.debug(`Optimist's Mongo blocks and timber dropped successfully!`);
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
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      const firstBlock = await getLatestBlock();

      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await restartOptimist(false);

      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occurred
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      const secondBlock = await getLatestBlock();
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Resync optimist after making a good block dropping Db', async function () {
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      const firstBlock = await getLatestBlock();

      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await restartOptimist();

      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occurred
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      const secondBlock = await getLatestBlock();
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it.skip('Resync optimist after making an un-resolved bad block', async function () {
      // // We create enough good transactions to fill a block full of deposits.
      // logger.debug(`      Sending a deposit...`);
      // let p = proposePromise();
      // await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      // await nf3User.makeBlockNow();
      // ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // // The promise resolves once the block is on-chain.
      // const { block, transactions } = await p;
      // const firstBlock = { ...block };
      // // turn off challenging.  We're going to make a bad block and we don't want it challenged
      // await nf3Challenger.challengeEnable(false);
      // // update the block so we can submit it again
      // // we'll do the easiest thing and submit it again with no change other than to increment
      // // the L2 block number and block hash so that it doesn't get reverted straight away.
      // // It will be a bad block because we'll have submitted the same transactions and leafcount
      // // before.
      // // To achieve that, we'll manually assemble and submit a new proposeBlock call
      // // in the following lines...
      // // retrieve the code for the 'proposeBlock' function. We'll check it every time rather than
      // // hard code it, in case someone changes the function.
      // const functionCode = (
      //   await web3.eth.getTransaction(eventsSeen[0].log.transactionHash)
      // ).input.slice(0, 10);
      // // fix up the blockHash and blockNumberL2 to prevent an immediate revert
      // block.previousBlockHash = block.blockHash;
      // block.blockNumberL2++;
      // // now assemble our bad-block transaction; first the parameters
      // const blockData = Object.values(buildBlockSolidityStruct(block));
      // const transactionsData = Object.values(
      //   transactions.map(t => Object.values(Transaction.buildSolidityStruct(t))),
      // );
      // const encodedParams = web3Client
      //   .getWeb3()
      //   .eth.abi.encodeParameters(PROPOSE_BLOCK, [blockData, transactionsData]);
      // // then the function identifier is added
      // const newTx = `${functionCode}${encodedParams.slice(2)}`;
      // // then send it!
      // logger.debug('Resubmitting the same transactions in the next block');
      // await web3Client.submitTransaction(newTx, signingKeys.proposer1, stateAddress, 8000000, 1);
      // logger.debug('bad block submitted');
      // const r = rollbackPromise();
      // // Now we have a bad block, let's force Optimist to re-sync by turning it off and on again!
      // await restartOptimist();
      // logger.debug('waiting for rollback to complete');
      // await r;
      // logger.debug('rollback complete event received');
      // // the rollback will have removed us as proposer. We need to re-register because we
      // // were the only proposer in town!
      // await nf3Proposer.registerProposer('http://optimist', minimumStake);
      // // Now we'll add another block and check that it's blocknumber is correct, indicating
      // // that a rollback correctly occurred
      // logger.debug(`      Sending a deposit...`);
      // p = proposePromise();
      // await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      // await nf3User.makeBlockNow();
      // // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // // The promise resolves once the block is on-chain.
      // const { block: secondBlock } = await p;
      // ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });
  });

  after(async () => {
    await mongo.disconnect(MONGO_URL);
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Challenger.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
