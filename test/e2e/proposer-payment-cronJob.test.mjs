/* eslint-disable no-await-in-loop */
import chai from 'chai';
// import gen from 'general-number';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
// import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  // depositNTransactions,
  getLayer2Balances,
  expectTransaction,
  // waitForSufficientBalance,
  // waitForSufficientTransactionsMempool,
  Web3Client,
  // getUserCommitments,
} from '../utils.mjs';
// import { approve } from '../../../cli/lib/tokens.mjs';
// import constants from '../../../common-files/constants/index.mjs';

const { expect } = chai;
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
  // restrictions: { erc20default },
} = config.TEST_OPTIONS;
// const {
//   RESTRICTIONS: {
//     tokens: { blockchain: maxWithdrawValue },
//   },
// } = config;

// const { BN128_GROUP_ORDER } = constants;

const web3Client = new Web3Client();
const eventLogs = [];
// const logs = {
//   instantWithdraw: 0,
// };
let rollbackCount = 0;

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Challenger = new Nf3(signingKeys.challenger, environment);
// const nf3User2 = new Nf3(signingKeys.user2, environment);
// const nf3UserSanctioned = new Nf3(signingKeys.sanctionedUser, environment);

const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('Cron Job test', () => {
  let erc20Address;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3Challenger.init(mnemonics.challenger);
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.setWeb3Provider();
    const web3 = nf3Proposer.getWeb3Provider();
    console.log('--before proposer register it balance is---', nf3Proposer.ethereumAddress);
    console.log(
      '--proposer account balance---',
      await web3.eth.getBalance(nf3Proposer.ethereumAddress),
    );
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });

    await nf3Challenger.startChallenger();

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Proposer payments', () => {
    beforeEach(async () => {
      console.log('-----proposer stake ---', await nf3Proposer.getProposerStake());
      const web3 = nf3Proposer.getWeb3Provider();
      console.log(
        '--proposer account balance---',
        await web3.eth.getBalance(nf3Proposer.ethereumAddress),
      );
    });

    it('Should increment user L2 balance after depositing some ERC20', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
    });

    it('Should increment user L2 balance after depositing some ERC20', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
    });

    it('Get block payment and add in pending withdraw of proposer', async () => {
      const blockHashs = (await nf3Proposer.getProposerPendingPayments()).map(rec => rec.blockHash);
      await web3Client.timeJump(3600 * 24 * 10);
      console.log(
        '--after time jump- getProposerPendingPayments ---',
        await nf3Proposer.getProposerPendingPayments(),
      );
      for (const blockHash of blockHashs) {
        console.log('--blockHash---', blockHash);
        await nf3Proposer.requestBlockPayment(blockHash);
      }
    });

    // it.skip('withdraw proposer stake', async () => {
    //   await nf3Proposer.deregisterProposer();
    //   await web3Client.timeJump(3600 * 24 * 10);
    //   await nf3Proposer.withdrawStake();
    //   console.log(
    //     '-----proposer stake after nf3Proposer.withdrawStake()---',
    //     await nf3Proposer.getProposerStake(),
    //   );
    //   const web3 = nf3Proposer.getWeb3Provider();
    //   console.log(
    //     '--proposer account balance---',
    //     await web3.eth.getBalance(nf3Proposer.ethereumAddress),
    //   );
    // });
  });

  after(async () => {
    await new Promise(reslove => setTimeout(reslove, 300000));
    console.log(
      '------in after block--------proposer stake after nf3Proposer.withdrawStake()---',
      await nf3Proposer.getProposerStake(),
    );
    const web3 = nf3Proposer.getWeb3Provider();
    console.log(
      '------in after block--------proposer account balance---',
      await web3.eth.getBalance(nf3Proposer.ethereumAddress),
    );
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
