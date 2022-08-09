/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import config from 'config';
import compose from 'docker-compose';
import constants from 'common-files/constants/index.mjs';
import Transaction from 'common-files/classes/transaction.mjs';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import { depositNTransactions, Web3Client } from './utils.mjs';
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

const { PROPOSE_BLOCK_TYPES } = constants;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);

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
const emptyL2 = async nf3Instance => {
  let count = await nf3Instance.unprocessedTransactionCount();
  while (count !== 0) {
    if (count % txPerBlock) {
      await depositNTransactions(
        nf3Instance,
        count % txPerBlock ? count % txPerBlock : txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );

      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    } else {
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    }

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
  ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
};

describe('ERC20 tests', () => {
  let blockProposeEmitter;
  let challengeEmitter;
  const options = {
    config: ['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.ganache.yml'],
    log: true,
  };

  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Challenger.init(mnemonics.challenger);
    // we must set the URL from the point of view of the client container
    await nf3Proposer1.registerProposer('http://optimist1');
    await nf3Challenger.registerChallenger();

    // Proposer listening for incoming events
    blockProposeEmitter = await nf3Proposer1.startProposer();
    challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter.on('receipt', (receipt, type) =>
      console.log(`got challenge receipt of type ${type}`),
    );
    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    // await emptyL2(nf3Users[0]);
  });

  afterEach(async () => {
    // await emptyL2(nf3Users[0]);
  });

  describe('Blocks', () => {
    // setup a listener for a block proposal
    const proposePromise = () =>
      new Promise(resolve =>
        blockProposeEmitter.on('receipt', (receipt, b, t) =>
          resolve({ receipt, block: b, transactions: t }),
        ),
      );
    // and a listener for a challenge
    const challengePromise = () =>
      new Promise((resolve, reject) => {
        challengeEmitter.on('receipt', (r, t) => {
          if (t === 'challenge') resolve({ receipt: r, type: t });
        });
        challengeEmitter.on('error', err => reject(err));
      });

    it('should make a block of two deposit transactions, then a bad block containing the same deposit transactions', async function () {
      let block;
      let transactions;
      // We create enough good transactions to fill a block full of deposits.
      console.log(`      Sending ${txPerBlock} deposits...`);
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
      ({ block, transactions } = await p);
      console.log('BLOCK PROPOSED', block);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));

      // turn off challenging.  We're going to make a bad block and we don't want it challenged
      await nf3Challenger.challengeEnable(false);
      // update the block so we can submit it again
      // we'll do the easiest thing and submit it again with no change other than to increment
      // the L2 block number and block hash.
      block.previousBlockHash = block.blockHash;
      block.blockNumberL2++;
      const blockData = Object.values(buildBlockSolidityStruct(block));
      const transactionsData = Object.values(
        transactions.map(t => Object.values(Transaction.buildSolidityStruct(t))),
      );
      const encodedParams = web3Client
        .getWeb3()
        .eth.abi.encodeParameters(PROPOSE_BLOCK_TYPES, [blockData, transactionsData]);
      const newTx = `0xa9cb3b6f${encodedParams.slice(2)}`;
      logger.debug('Resubmitting the same transactions in the next block');
      await web3Client.submitTransaction(newTx, signingKeys.proposer1, stateAddress, 8000000, 1);
      console.log('bad block submitted');

      // Now we have a bad block, let's force Optimist to re-sync by turning it off and on again!
      await compose.stopOne('optimist1', options);
      await compose.upOne('optimist1', options);

      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // catch to prevent the test exiting while tests are developed.  Remove later
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Challenger.deregisterChallenger();
    await nf3Challenger.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});

/*
console.log('GOT RECEIPT', rec);
// We're currently only allowed on proposer (the boot proposer), and it's been removed. Therefore
// we must add it back before any more blocks can be proposer.
await nf3Proposer1.registerProposer('http://optimist1');
// now we'll create a new good block (we won't wait for the rollback to complete because
// this block should stay in Optimist's queue 0 until the rollback completes).

// the promise resolves once the challenge is on-chain
const { type } = await challengePromise();
console.log('GOT CHALLENGE', type);
// once the challenge is on-chain, the rollback will have happened and the proposer
// removed, because it's a righteous challenge
expect(await nf3Proposer1.getCurrentProposer()).to.equal(
  '0x0000000000000000000000000000000000000000',
);
*/
