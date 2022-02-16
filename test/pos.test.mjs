/**
Test suite for measuring the gas per transaction
*/
import config from 'config';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  closeWeb3Connection,
  connectWeb3,
  getCurrentEnvironment,
  expectTransaction,
  waitForEvent,
  topicEventMapping,
  timeJump,
} from './utils.mjs';

const {
  ethereumSigningKeyUser1,
  ethereumSigningKeyProposer1,
  ethereumSigningKeyChallenger,
  ethereumSigningKeyLiquidityProvider,
  mnemonicUser1,
  mnemonicProposer,
  mnemonicChallenger,
  mnemonicLiquidityProvider,
  tokenType,
  value,
  tokenId,
  fee,
  BLOCK_STAKE,
} = config.TEST_OPTIONS;

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = getCurrentEnvironment();

const TRANSACTIONS_PER_BLOCK = 2;
const MINIMUM_STAKE = 10;
let currentGasCostPerTx = 0;
let web3;
let stateAddress;
let eventLogs = [];

const miniStateABI = [
  {
    inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
    name: 'getStakeAccount',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'challengeLocked',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'time',
            type: 'uint256',
          },
        ],
        internalType: 'struct Structures.TimeLockedStake',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

describe('Testing the http API', () => {
  let ercAddress;
  let nodeInfo;

  console.log('ENVIRONMENT: ', environment);
  const nf3User1 = new Nf3(environment.web3WsUrl, ethereumSigningKeyUser1, environment);
  const nf3Proposer1 = new Nf3(environment.web3WsUrl, ethereumSigningKeyProposer1, environment);
  const nf3Proposer2 = new Nf3(environment.web3WsUrl, ethereumSigningKeyChallenger, environment);
  const nf3Proposer3 = new Nf3(
    environment.web3WsUrl,
    ethereumSigningKeyLiquidityProvider,
    environment,
  );

  const getStakeAccount = async ethAccount => {
    const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
    const stakeAccount = await stateContractInstance.methods.getStakeAccount(ethAccount).call();
    return stakeAccount;
  };

  before(async () => {
    web3 = await connectWeb3();

    stateAddress = await nf3User1.getContractAddress('State');
    ercAddress = await nf3User1.getContractAddress('ERC20Mock');

    nodeInfo = await web3.eth.getNodeInfo();

    await nf3User1.init(mnemonicUser1);
    await nf3Proposer1.init(mnemonicProposer);
    await nf3Proposer2.init(mnemonicChallenger);
    await nf3Proposer3.init(mnemonicLiquidityProvider);
    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      currentGasCostPerTx = gasUsed / TRANSACTIONS_PER_BLOCK;
      console.log(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${currentGasCostPerTx}`,
      );
    });

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });
  });

  describe('Basic Proposer staking tests', () => {
    it('should stake as proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer1.getProposers());
      const currentProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      // In order to begin from 0 producing L2 blocks
      if (currentProposer.length === 1) {
        console.log('Unstaking proposer...');
        try {
          await nf3Proposer1.unstakeProposer();
        } catch (e) {
          console.log(e);
        }
      }

      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      const res = await nf3Proposer1.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      ({ proposers } = await nf3Proposer1.getProposers());
      const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('should increase stake for a proposer', async () => {
      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      const res = await nf3Proposer1.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('should increase stake locked in challenge period', async () => {
      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK * 2; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expectTransaction(res);
      }

      eventLogs = await waitForEvent(eventLogs, ['blockProposed'], 2);
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      expect(Number(stakeAccount2.amount)).equal(Number(stakeAccount1.amount) - 2 * BLOCK_STAKE);
      expect(Number(stakeAccount2.challengeLocked)).equal(
        Number(stakeAccount1.challengeLocked) + 2 * BLOCK_STAKE,
      );
    });

    it('should get pending payments for this proposer in challenge period', async () => {
      const pending = await nf3Proposer1.getProposerPendingPayments();
      const pendingChallengePeriod = pending.pendingPayments.filter(
        p => p.challengePeriod === true,
      );
      expect(pending.pendingPayments.length).greaterThan(0);
      expect(pendingChallengePeriod.length).greaterThan(0);
    });

    it('should get and pay pending payments for this proposer after challenge period', async () => {
      if (nodeInfo.includes('TestRPC')) {
        await timeJump(3600 * 24 * 10); // jump in time by 10 days
        const pending = await nf3Proposer1.getProposerPendingPayments();
        const pendingChallengePeriod = pending.pendingPayments.filter(
          p => p.challengePeriod === true,
        );
        expect(pending.pendingPayments.length).greaterThan(0);
        expect(pendingChallengePeriod.length).equal(0);

        const stakeAccountIni = await getStakeAccount(nf3Proposer1.ethereumAddress);
        for (let i = 0; i < pending.pendingPayments.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          const res = await nf3Proposer1.requestBlockPayment(pending.pendingPayments[i].blockHash);
          expectTransaction(res);
        }

        const stakeAccountEnd = await getStakeAccount(nf3Proposer1.ethereumAddress);
        expect(Number(stakeAccountEnd.amount)).equal(
          Number(stakeAccountIni.amount) + pending.pendingPayments.length * BLOCK_STAKE,
        );
        expect(Number(stakeAccountEnd.challengeLocked)).equal(
          Number(stakeAccountIni.challengeLocked) - pending.pendingPayments.length * BLOCK_STAKE,
        );
      } else {
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });

    it('should stake second proposer', async () => {
      // Proposer listening for incoming events
      const newGasBlockEmitter = await nf3Proposer2.startProposer();
      newGasBlockEmitter.on('gascost', async gasUsed => {
        currentGasCostPerTx = gasUsed / TRANSACTIONS_PER_BLOCK;
        console.log(
          `(2) Block proposal gas cost was ${gasUsed}, cost per transaction was ${currentGasCostPerTx}`,
        );
      });

      let proposers;
      ({ proposers } = await nf3Proposer2.getProposers());
      let thisProposer;
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer3.ethereumAddress);
      expect(thisProposer.length).to.be.equal(0);
      const stakeAccount1 = await getStakeAccount(nf3Proposer2.ethereumAddress);
      const res = await nf3Proposer2.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer2.ethereumAddress);
      ({ proposers } = await nf3Proposer2.getProposers());
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer2.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('should stake third proposer', async () => {
      // Proposer listening for incoming events
      const newGasBlockEmitter = await nf3Proposer3.startProposer();
      newGasBlockEmitter.on('gascost', async gasUsed => {
        currentGasCostPerTx = gasUsed / TRANSACTIONS_PER_BLOCK;
        console.log(
          `(3) Block proposal gas cost was ${gasUsed}, cost per transaction was ${currentGasCostPerTx}`,
        );
      });

      let proposers;
      ({ proposers } = await nf3Proposer2.getProposers());
      let thisProposer;
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer3.ethereumAddress);
      expect(thisProposer.length).to.be.equal(0);
      const stakeAccount1 = await getStakeAccount(nf3Proposer3.ethereumAddress);
      const res = await nf3Proposer3.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer3.ethereumAddress);
      ({ proposers } = await nf3Proposer3.getProposers());
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer3.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('Should create a failing changeCurrentProposer (because insufficient time has passed)', async function () {
      let error = null;
      try {
        const res = await nf3Proposer2.changeCurrentProposer();
        expectTransaction(res);
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    });

    it('should unstake proposers', async () => {
      try {
        await nf3Proposer3.unstakeProposer();
        await nf3Proposer2.unstakeProposer();
        await nf3Proposer1.unstakeProposer();
      } catch (e) {
        console.log(e);
      }
    });
  });

  after(async () => {
    closeWeb3Connection();
    nf3User1.close();
    nf3Proposer1.close();
    nf3Proposer2.close();
    nf3Proposer3.close();
  });
});
