/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
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
  });

  describe('Blocks', () => {
    // setup a listener for a block proposal
    const proposePromise = () =>
      new Promise(resolve =>
        blockProposeEmitter.on('receipt', (receipt, b, t) =>
          resolve({ receipt, block: b, transactions: t }),
        ),
      );
    // setup a listener for a block proposal
    const rollbackPromise = () =>
      new Promise(resolve => blockProposeEmitter.on('rollback', () => resolve()));

    // setup a healthcheck wait
    const healthy = async () => {
      while (!(await nf3Proposer1.healthcheck('optimist'))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      logger.debug('optimist is healthy');
    };

    it('Resync optimist after making a good block', async function () {
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
      const { block } = await p;
      const firstBlock = { ...block };
      console.log('BLOCK PROPOSED', block);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await compose.stopOne('optimist1', options);
      await compose.rm(options, 'optimist1');
      await compose.upOne('optimist1', options);
      await healthy();

      // we need to remind optimist which proposer it's connected to
      await nf3Proposer1.registerProposer('http://optimist1');
      // TODO - get optimist to do this automatically.
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occured
      console.log(`      Sending ${txPerBlock} deposits...`);
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
      console.log('BLOCK PROPOSED', block);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      console.log('BLOCKS', block, secondBlock);
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);

      console.log('FINISHED');
    });
    it('Resync optimist after making an un-resolved bad block', async function () {
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
      const { block, transactions } = await p;
      const firstBlock = { ...block };
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
      const r = rollbackPromise();
      // Now we have a bad block, let's force Optimist to re-sync by turning it off and on again!
      await compose.stopOne('optimist1', options);
      await compose.rm(options, 'optimist1');
      await compose.upOne('optimist1', options);
      await healthy();

      await r;
      console.log('rollback complete event received');
      // the rollback will have removed us as proposer. We need to re-register because we
      // were the only proposer in town!
      await nf3Proposer1.registerProposer('http://optimist1');
      console.log('REREGISTERED PROPOSER');
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a rollback correctly occured
      console.log(`      Sending ${txPerBlock} deposits...`);
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
      console.log('BLOCK PROPOSED', block);
      // we still need to clean the 'BlockProposed' event from the  test logs though.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      console.log('BLOCKS', block, secondBlock);
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);

      console.log('FINISHED');
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
