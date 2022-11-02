/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import axios from 'axios';
import Nf3 from '../cli/lib/nf3.mjs';
import { depositNTransactions, Web3Client, waitForTimeout } from './utils.mjs';

// so we can use require with mjs file
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// we need require here to import jsons
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  MINIMUM_STAKE,
  NUMBER_L2_BLOCKS,
} = config.TEST_OPTIONS;

const txPerBlock = process.env.TRANSACTIONS_PER_BLOCK || 32;
const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];

describe('Stress test', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer('http://optimist', MINIMUM_STAKE);
    await nf3Proposer1.startProposer();

    // Proposer listening for incoming events
    await nf3Users[0].init(mnemonics.user1);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Send Deposits', () => {
    it('Generate transactions and measure block assembly time', async function () {
      let pendingBlocks = NUMBER_L2_BLOCKS;
      const blockTimestamp = [];
      let startTime;
      await axios.post(`${environment.optimistApiUrl}/debug/tx-submitted-enable`, {
        enable: false,
      });
      // We create enough transactions to fill blocks full of deposits.
      await depositNTransactions(
        nf3Users[0],
        txPerBlock * NUMBER_L2_BLOCKS,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        0,
      );

      await waitForTimeout(30000);
      console.log('Start transaction processing...');
      await axios.post(`${environment.optimistApiUrl}/debug/tx-submitted-enable`, { enable: true });
      while (pendingBlocks) {
        console.log('Pending L2 blocks', pendingBlocks);
        startTime = new Date().getTime();
        await web3Client.waitForEvent(eventLogs, ['blockProposed']);
        blockTimestamp.push(new Date().getTime() - startTime);
        pendingBlocks -= 1;
      }
      console.log('Block times', blockTimestamp);
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await web3Client.closeWeb3();
  });
});
