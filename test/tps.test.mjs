/* eslint-disable no-await-in-loop */
import config from 'config';
import Nf3 from '../../cli/lib/nf3.mjs';
import { pendingCommitmentCount, Web3Client } from '../utils.mjs';
import logger from '../../common-files/utils/logger.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

// environment
//   clientApiUrl: 'http://localhost:8080',
//   optimistApiUrl: 'http://localhost:8081',
//   optimistWsUrl: 'ws://localhost:8082',
//   web3WsUrl: 'ws://localhost:8546',
 
const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const totalTx = txPerBlock * 10;

const eventLogs = [];

const emptyL2 = async () => {
  await new Promise(resolve => setTimeout(resolve, 6000));
  let count = await pendingCommitmentCount(nf3User);
  while (count !== 0) {
    await nf3User.makeBlockNow();
    try {
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      count = await pendingCommitmentCount(nf3User);
    } catch (err) {
      break;
    }
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
};


describe('TPS test', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);

    await nf3User.init(mnemonics.user1);
    erc20Address = await nf3User.getContractAddress('ERC20Mock');

    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    it(`should do ${totalTx} deposits`, async function () {
      emptyL2();
      for (let i = 0; i < totalTx; i++) {
        console.log(`deposit number ${i}`);
        await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      }
    });
  });

  describe('Start proposer', () => {
    it(`should do blocks for ${totalTx} deposits`, async function () {
      let numTx = 0;
      performance.mark('A');

      // we must set the URL from the point of view of the client container
      await nf3Proposer.registerProposer('http://optimist');

      // Proposer listening for incoming events
      const newGasBlockEmitter = await nf3Proposer.startProposer();
      newGasBlockEmitter.on('receipt', async (receipt, block) => {
        const { gasUsed } = receipt;
        numTx += block.transactionHashes.length;
        logger.debug(
          `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
            gasUsed / txPerBlock
          }`,
        );
      });

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } while (numTx < totalTx);

      performance.mark('B');
      performance.measure('A to B', 'A', 'B');
      const measure = performance.getEntriesByName('A to B')[0];
      logger.debug(
        `Time elapsed ${measure.duration}, ${numTx} transactions, ${
          numTx / (measure.duration / 1000)
        } TPS`,
      );

      // apparently you should clean up...
      performance.clearMarks();
      performance.clearMeasures();
      expect(numTx).to.be.equal(totalTx);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    await web3Client.closeWeb3();
  });
});
