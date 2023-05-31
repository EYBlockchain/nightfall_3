/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { buildBlockSolidityStruct } from 'common-files/utils/block-utils.mjs';
import Transaction from 'common-files/classes/transaction.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  Web3Client,
  waitForTimeout,
  restartOptimist,
  dropMongoLastBlock,
  getOptimistMongoL2Blocks,
  getClientMongoL2Blocks,
} from './utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const {
  fee,
  transferValue,
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

  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Challenger.init(mnemonics.challenger);
    minimumStake = await nf3Proposer1.getMinimumStake();
    // we must set the URL from the point of view of the client container
    await nf3Proposer1.registerProposer('http://localhost:8081', minimumStake);

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

    it('Resync optimist after making a good block without dropping dB', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending a deposit...`);
      let p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block } = await p;
      const firstBlock = { ...block };
      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await waitForTimeout(5000);
      await restartOptimist(nf3Proposer1, false);

      // we need to remind optimist which proposer it's connected to
      await nf3Proposer1.registerProposer('http://localhost:8081', minimumStake);
      await waitForTimeout(5000);
      // TODO - get optimist to do this automatically.
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occured
      logger.debug(`      Sending a deposit...`);
      p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Drop block from dB, and check optimist catches event and forces a resync', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending a deposit...`);
      let p = proposePromise();

      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block } = await p;
      const firstBlock = { ...block };
      // Now we have a block, let's delete last block from dB and create new one to force resync
      p = proposePromise();

      logger.debug(`      Sending a second deposit...`);
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      await nf3Users[0].makeBlockNow();
      logger.debug(`      Request make block...`);
      await waitForTimeout(1000);
      logger.debug(`      Request Drop last block from mongo...`);
      dropMongoLastBlock();
      logger.debug(`      Wait for event blockProposed...`);
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      logger.debug(`      blockProposed...`);
      const { block: secondBlock } = await p;
      logger.debug(`      resolve propose promise...${secondBlock}`);

      await waitForTimeout(5000);
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);

      // Check that we have all blocks now
      const nL2BlocksOptimist = await getOptimistMongoL2Blocks();
      const nL2BlocksClient = await getClientMongoL2Blocks();
      logger.debug(
        `Blocks after dropping: client: ${nL2BlocksClient}, optimist ${nL2BlocksOptimist}`,
      );
      expect(nL2BlocksOptimist - secondBlock.blockNumberL2).to.equal(1);
      expect(nL2BlocksClient - secondBlock.blockNumberL2).to.equal(1);
    });

    it('Resync optimist after making a good block dropping Db', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending a deposit...`);
      let p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block } = await p;
      const firstBlock = { ...block };
      // Now we have a block, let's force Optimist to re-sync by turning it off and on again!
      await restartOptimist(nf3Proposer1, true);

      // we need to remind optimist which proposer it's connected to
      await nf3Proposer1.registerProposer('http://localhost:8081', minimumStake);
      // TODO - get optimist to do this automatically.
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a resync correctly occured
      logger.debug(`      Sending a deposit...`);
      p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;
      expect(secondBlock.blockNumberL2 - firstBlock.blockNumberL2).to.equal(1);
    });

    it('Resync optimist after making an un-resolved bad block', async function () {
      // We create enough good transactions to fill a block full of deposits.
      logger.debug(`      Sending a deposit...`);
      let p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();

      ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block, transactions } = await p;
      const firstBlock = { ...block };
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
      await restartOptimist(nf3Proposer1, true);

      logger.debug('waiting for rollback to complete');
      await r;
      logger.debug('rollback complete event received');
      // the rollback will have removed us as proposer. We need to re-register because we
      // were the only proposer in town!
      await nf3Proposer1.registerProposer('http://localhost:8081', minimumStake);
      // Now we'll add another block and check that it's blocknumber is correct, indicating
      // that a rollback correctly occured
      logger.debug(`      Sending a deposit...`);
      p = proposePromise();
      await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);

      await nf3Users[0].makeBlockNow();

      // we can use the emitter that nf3 provides to get the block and transactions we've just made.
      // The promise resolves once the block is on-chain.
      const { block: secondBlock } = await p;

      ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
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
