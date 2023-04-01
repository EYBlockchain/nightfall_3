/* eslint-disable no-await-in-loop */
import chai from 'chai';
// import gen from 'general-number';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  // getLayer2Balances,
  expectTransaction,
  Web3Client,
  // getUserCommitments,
  getTransactions,
  // restartClient,
} from './utils.mjs';

// const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// const { generalise } = gen;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const eventLogs = [];
let rollbackCount = 0;

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3User2 = new Nf3(signingKeys.user2, environment);

const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('Client synchronisation tests', () => {
  let erc20Address;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    web3Client.subscribeTo('logs', eventLogs, { address: nf3User.stateContractAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: nf3User.shieldContractAddress });
  });

  describe('Deposits', () => {
    it('Should increment user L2 balance after depositing some ERC20', async function () {
      // const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      console.log('---res---', res);
      expectTransaction(res);
      await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      logger.info(
        `------getTransactions---${JSON.stringify(
          await getTransactions(environment.clientApiUrl),
        )}`,
      );
      await makeBlock();

      // const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      // logger.info(`---userL2BalanceAfter-- ${userL2BalanceAfter}`);
      // expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
    });
  });
});
