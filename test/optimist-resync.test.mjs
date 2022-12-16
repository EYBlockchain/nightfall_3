/* eslint-disable @babel/no-unused-expressions */
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
const {
  MONGO_URL,
  OPTIMIST_DB,
  PROPOSER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TIMBER_COLLECTION,
} = config;

const web3Client = new Web3Client();
// const web3 = web3Client.getWeb3();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
nf3Proposer.setApiKey(environment.AUTH_TOKEN);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);

const connection = await mongo.connection(MONGO_URL);
const db = connection.db(OPTIMIST_DB);

const dockerComposeOptions = {
  config: [
    'docker/docker-compose.yml',
    'docker/docker-compose.dev.yml',
    'docker/docker-compose.ganache.yml',
  ],
  log: process.env.LOG_LEVEL || 'silent',
  composeOptions: [['-p', 'nightfall_3']],
};

async function healthy() {
  while (!(await nf3Proposer.healthcheck('optimist'))) {
    await waitForTimeout(1000);
  }

  logger.debug('optimist is healthy');
}

async function makeBlock() {
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

async function dropDbOptimistData() {
  logger.debug(`Dropping Optimist's Mongo database`);

  while (!(await db.dropDatabase())) {
    logger.debug(`Retrying dropping MongoDB`);
    await waitForTimeout(2000);
  }

  logger.debug(`Optimist's Mongo database dropped successfully!`);
}

async function dropCollectionsBlocksTimber() {
  logger.debug(`Dropping Optimist's Mongo collection`);

  while (!(await db.collection(SUBMITTED_BLOCKS_COLLECTION).drop())) {
    logger.debug(`Retrying dropping MongoDB blocks collection`);
    await waitForTimeout(2000);
  }
  while (!(await db.collection(TIMBER_COLLECTION).drop())) {
    logger.debug(`Retrying dropping MongoDB timber collection`);
    await waitForTimeout(2000);
  }

  logger.debug(`Optimist's Mongo blocks and timber dropped successfully!`);
}

async function restartOptimist(dropDb = true) {
  await compose.stopOne('optimist', dockerComposeOptions);
  await compose.rm(dockerComposeOptions, 'optimist');

  // dropDb vs dropCollection.
  if (dropDb) {
    await dropDbOptimistData();
  } else {
    await dropCollectionsBlocksTimber();
  }

  await compose.upOne('optimist', dockerComposeOptions);

  await healthy();
}

async function getOptimistDataCollections() {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return collections.map(c => c.name);
}

async function getBlocksCollOldestFirst() {
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).find().sort({ blockNumberL2: 1 }).toArray();
}

async function getProposersColl() {
  return db.collection(PROPOSER_COLLECTION).find().toArray();
}

describe('Optimist synchronisation tests', function () {
  let erc20Address;
  let stateAddress;
  let challengeEmitter;

  before(async function () {
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

  describe('Resync optimist after making a good block without dropping dB', async function () {
    let dbCollectionsBefore;
    let dbBlocksBefore;
    let dbProposersBefore;
    let blockchainProposersBefore;

    let dbCollectionsAfter;

    let dbCollectionsFinal;
    let dbBlocksFinal;
    let dbProposersFinal;
    let blockchainProposersFinal;

    before(async function () {
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      dbCollectionsBefore = await getOptimistDataCollections();
      dbBlocksBefore = await getBlocksCollOldestFirst();
      dbProposersBefore = await getProposersColl();
      blockchainProposersBefore = (await nf3Proposer.getProposers()).proposers;

      // Restart optimist only dropping some collections
      await restartOptimist(false);
      dbCollectionsAfter = await getOptimistDataCollections();

      // Now we'll add another block and check later that its blocknumber is correct
      logger.debug('Sending a deposit...');
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      logger.debug('Make block...');
      await makeBlock();

      dbCollectionsFinal = await getOptimistDataCollections();
      dbBlocksFinal = await getBlocksCollOldestFirst();
      dbProposersFinal = await getProposersColl();
      blockchainProposersFinal = (await nf3Proposer.getProposers()).proposers;
    });

    it('Should include `blocks` collection before restart', function () {
      expect(dbCollectionsBefore).to.be.an('array').that.does.include(SUBMITTED_BLOCKS_COLLECTION);
    });

    it('Should include `timber` collection before restart', function () {
      expect(dbCollectionsBefore).to.be.an('array').that.does.include(TIMBER_COLLECTION);
    });

    it('Should have at least 1 block in `blocks` collection before restart', function () {
      dbBlocksBefore.forEach(b => console.log(`===> bs before: ${JSON.stringify(b)}`));
      expect(dbBlocksBefore).to.be.an('array').that.is.not.empty;
    });

    it('Should include nf3Proposer in `proposers` collection before restart', function () {
      dbProposersBefore.forEach(p => console.log(`**** ps before: ${JSON.stringify(p)}`));
      const proposerIds = dbProposersBefore.map(p => p._id);
      expect(proposerIds.includes(nf3Proposer.ethereumAddress)).to.be.true;
    });

    it('Should include nf3Proposer in Proposers smart contract before restart', function () {
      blockchainProposersBefore.forEach(p => console.log(`++++ bps before: ${JSON.stringify(p)}`));
      const proposerAddresses = blockchainProposersBefore.map(p => p.thisAddress);
      expect(proposerAddresses.includes(nf3Proposer.ethereumAddress)).to.be.true;
    });

    it('Should not include `blocks` collection after restart', function () {
      expect(dbCollectionsAfter)
        .to.be.an('array')
        .that.does.not.include(SUBMITTED_BLOCKS_COLLECTION);
    });

    it('Should include `blocks` collection after restarting and making another block', function () {
      expect(dbCollectionsFinal).to.be.an('array').that.does.include(SUBMITTED_BLOCKS_COLLECTION);
    });

    it('Should have 1 more block in `blocks` collection after restarting and making another block', function () {
      dbBlocksFinal.forEach(b => console.log(`===> bs final: ${JSON.stringify(b)}`));
      console.log(`===> try this...: ${JSON.stringify(dbBlocksFinal)}`);
      expect(dbBlocksFinal.length - dbBlocksBefore.length).to.equal(1);
    });

    it('Should have added new block sequentially after restarting and making another block', function () {
      const firstBlock = dbBlocksBefore[dbBlocksBefore.length - 1];
      console.log(`***********************************firstBlock: ${JSON.stringify(firstBlock)}`);
      const secondBlock = dbBlocksFinal[dbBlocksFinal.length - 1];
      console.log(`***********************************secondBlock: ${JSON.stringify(secondBlock)}`);
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Should have same `proposers` collection', function () {
      dbProposersFinal.forEach(p => console.log(`**** ps final: ${JSON.stringify(p)}`));
      expect(dbProposersFinal).to.be.deep.equal(dbProposersBefore);
    });

    it('Should have same `proposers` in Proposers smart contract', function () {
      blockchainProposersFinal.forEach(p => console.log(`++++ bps before: ${JSON.stringify(p)}`));
      expect(blockchainProposersFinal).to.be.deep.equal(blockchainProposersBefore);
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
