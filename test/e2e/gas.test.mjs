/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import { depositNTransactions, Web3Client } from '../utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// we need require here to import jsons
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const txPerBlock = 32;
const expectedGasCostPerTx = 10000 * txPerBlock;
const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

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
      const tx = (count % txPerBlock) - 1;
      for (let i = 0; i < tx; i++) {
        eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      }
    } else {
      const tx = txPerBlock - count;

      await depositNTransactions(
        nf3Instance,
        tx,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );

      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      count = await nf3Instance.unprocessedTransactionCount();
    }
  }
};

describe('Gas test', () => {
  let gasCost = 0;
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('receipt', async receipt => {
      console.log(
        `Block proposal gas cost was ${receipt.gasUsed}, cost per transaction was ${
          receipt.gasUsed / txPerBlock
        }`,
      );
      gasCost = receipt.gasUsed;
      console.log(gasCost);
    });

    await nf3Users[0].init(mnemonics.user1);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    it('should get a reasonable amount of gas cost', async function () {
      // We create enough transactions to fill blocks full of deposits.
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      expect(gasCost).to.be.lessThan(expectedGasCostPerTx);
    });
  });

  after(async () => {
    await emptyL2(nf3Users[0]);
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await web3Client.closeWeb3();
  });
});
