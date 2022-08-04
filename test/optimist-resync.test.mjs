/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../cli/lib/nf3.mjs';
import { depositNTransactions, Web3Client } from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';
import {
  getProposeBlockCalldata,
  setWeb3,
} from '../nightfall-optimist/src/services/process-calldata.mjs';
import { buildBlockSolidityStruct } from '../nightfall-optimist/src/services/block-utils.mjs';
import Transaction from '../common-files/classes/transaction.mjs';
// so we can use require with mjs file
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

const { PROPOSE_BLOCK_TYPES } = config;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];
let eventsSeen = [];

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
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    // we must set the URL from the point of view of the client container
    await nf3Proposer.registerProposer('http://optimist1');
    await nf3Challenger.registerChallenger();

    // Proposer listening for incoming events
    blockProposeEmitter = await nf3Proposer.startProposer();

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await emptyL2(nf3Users[0]);
    setWeb3(web3Client.getWeb3());
  });

  afterEach(async () => {
    // await emptyL2(nf3Users[0]);
  });

  describe('Blocks', () => {
    it('should make a block of two deposit transactions, then a bad block containing the same deposit transactions', async function () {
      console.log(`      Sending ${txPerBlock} deposits...`);
      // We create enough transactions to fill blocks full of deposits.
      const depositTransactions = await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);
      logger.debug(`     Average Gas used was ${Math.ceil(totalGas / txPerBlock)}`);
      // now we have a single block proposed, full of deposits. the next job is to make a bad blocks
      // we can do that by recovering the blockPropsed transaction that's just happened, messing with it,
      // re-signing it with the proposer's key and sending it in again.
      const { block, transactions } = await getProposeBlockCalldata({
        transactionHash: eventsSeen[0].log.transactionHash,
      });
      // update the block so we can submit it again
      block.previousBlockHash = block.blockHash;
      block.blockNumberL2++;
      const blockData = Object.values(buildBlockSolidityStruct(block));
      const transactionsData = Object.values(
        transactions.map(t => Object.values(Transaction.buildSolidityStruct(t))),
      );
      const encodedParams = web3Client
        .getWeb3()
        .eth.abi.encodeParameters(PROPOSE_BLOCK_TYPES, [blockData, transactionsData]);
      // we'll do the easiest thing and submit it again with no change other than to increment the L2 block number.
      // That should trigger a duplicate commitment challenge.
      const newTx = `0xa9cb3b6f${encodedParams.slice(2)}`;
      logger.debug('Resubmitting the same transactions in the next block');
      web3Client.submitTransaction(newTx, signingKeys.proposer1, stateAddress, 8000000, 1);
      ({ eventLogs, eventsSeen } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
