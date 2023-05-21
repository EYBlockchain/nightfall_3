/* eslint-disable @babel/no-unused-expressions */
/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from 'common-files/classes/nf3.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const {
  mnemonics,
  signingKeys,
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
} = config.TEST_OPTIONS;

const nf3User = new Nf3(signingKeys.user1, environment);

const bootProposer = new Nf3(signingKeys.proposer1, environment);
const secondProposer = new Nf3(signingKeys.proposer2, environment);

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

const web3Client = new Web3Client();
const web3 = web3Client.getWeb3();
const eventLogs = [];

let minimumStake;
let rotateProposerBlocks;

let erc20Address;
let shieldAddress;
let stateAddress;
let stateContractInstance;

const CHANGE_PROPOSER_NO_TIMES = 8;

const getStakeAccount = async ethAccount => {
  const stakeAccount = await stateContractInstance.methods.getStakeAccount(ethAccount).call();
  return stakeAccount;
};

const getCurrentProposer = async () => {
  const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
  return currentProposer;
};

const getProposer = async proposerAddress => {
  const currentProposer = await stateContractInstance.methods.getProposer(proposerAddress).call();
  return currentProposer;
};

const getCurrentSprint = async () => {
  const currentSprint = await stateContractInstance.methods.currentSprint().call();
  return currentSprint;
};

describe('Basic Proposer tests', () => {
  before(async () => {
    await nf3User.init(mnemonics.user1);

    await bootProposer.init(mnemonics.proposer);
    await secondProposer.init(mnemonics.proposer);

    minimumStake = await bootProposer.getMinimumStake();
    rotateProposerBlocks = await bootProposer.getRotateProposerBlocks();

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    shieldAddress = nf3User.shieldContractAddress;
    stateAddress = nf3User.stateContractAddress;
    stateContractInstance = nf3User.stateContract;

    web3Client.subscribeTo('logs', eventLogs, { address: shieldAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    let proposer = await getProposer(secondProposer.ethereumAddress);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        await secondProposer.deregisterProposer();
      } catch (e) {
        console.log(e);
      }
    }

    proposer = await getProposer(bootProposer.ethereumAddress);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        await bootProposer.deregisterProposer();
      } catch (e) {
        console.log(e);
      }
    }
  });

  it('should register the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(bootProposer.ethereumAddress);
    const res = await bootProposer.registerProposer(testProposersUrl[0], minimumStake);
    expectTransaction(res);
    const stakeAccount2 = await getStakeAccount(bootProposer.ethereumAddress);
    const { proposers } = await bootProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(Number(stakeAccount1.amount) + Number(minimumStake));
  });

  it('should allow to register a second proposer other than the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(secondProposer.ethereumAddress);
    const res = await secondProposer.registerProposer(testProposersUrl[0], minimumStake);
    expectTransaction(res);
    const stakeAccount2 = await getStakeAccount(secondProposer.ethereumAddress);
    const { proposers } = await secondProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(Number(stakeAccount1.amount) + Number(minimumStake));
  });

  it('should update proposer url', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay stake to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3], 0, 0);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(thisProposer[0].url).to.be.equal(testProposersUrl[3]);
  });

  it('should increment the stake of the proposer', async () => {
    const initialStake = await getStakeAccount(bootProposer.ethereumAddress);
    const res = await bootProposer.updateProposer(testProposersUrl[0], minimumStake, 0);
    expectTransaction(res);
    const finalStake = await getStakeAccount(bootProposer.ethereumAddress);
    expect(Number(finalStake.amount)).to.be.equal(
      Number(initialStake.amount) + Number(minimumStake),
    );
  });

  it('should update proposer fee', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay stake to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3], 0, fee);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(Number(thisProposer[0].fee)).to.be.equal(fee);
  });

  it('should fail to register a proposer twice', async () => {
    const res = await bootProposer.registerProposer(testProposersUrl[2], minimumStake);
    // eslint-disable-next-line @babel/no-unused-expressions
    expect(res).to.be.false;
  });

  it('should create a failing changeCurrentProposer (because insufficient blocks has passed)', async () => {
    try {
      const res = await secondProposer.changeCurrentProposer();
      expectTransaction(res);
      expect.fail('Change proposer did not fail');
    } catch (err) {
      expect(err.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  it('should be able to query the proposer mempool when it is empty', async () => {
    const mempool = await bootProposer.getMempoolTransactions();
    expect(mempool).to.be.an('array').that.is.empty;
  });

  it('should be able to get transactions in the proposer mempool', async () => {
    await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);

    const mempool = await bootProposer.getMempoolTransactions();
    expect(mempool).to.have.lengthOf(1);
  });

  it('should fail when trying to filter the mempool by a hash that does not exist', async () => {
    try {
      await bootProposer.requestMempoolTransactionByL2TransactionHash('hash');
      expect.fail('Filter mempool did not fail');
    } catch (err) {
      expect(err.response).to.have.property('status', 404);
    }
  });

  it('should filter the mempool by l2 transaction hash', async () => {
    // Arrange
    // Find out l2 hash from previous deposit
    const depositTx = (await bootProposer.getMempoolTransactions())[0];
    const l2TxHash = depositTx._id;

    // Act, assert
    const { data: tx } = await bootProposer.requestMempoolTransactionByL2TransactionHash(l2TxHash);
    expect(tx).to.have.property('blockNumberL2', -1); // -1 signals 'tx in mempool'
  });

  it('should create a block and increase the L2 balance', async () => {
    await bootProposer.startProposer(); // start proposer to listen making blocks

    const currentZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;

    // note deposit made in previous mempool test
    await bootProposer.makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    const afterZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;
    expect(afterZkpPublicKeyBalance - currentZkpPublicKeyBalance).to.be.equal(transferValue - fee);
  });

  it('should create a valid changeCurrentProposer (because blocks have passed)', async function () {
    let numChanges = 0;
    for (let i = 0; i < CHANGE_PROPOSER_NO_TIMES; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const currentSprint = await getCurrentSprint();
        // eslint-disable-next-line no-await-in-loop
        const currentProposer = await getCurrentProposer();
        console.log(
          `     [ Current sprint: ${currentSprint}, Current proposer: ${currentProposer.thisAddress} ]`,
        );

        console.log('     Waiting blocks to rotate current proposer...');
        const initBlock = await web3.eth.getBlockNumber();
        let currentBlock = initBlock;

        while (currentBlock - initBlock < rotateProposerBlocks) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          currentBlock = await web3.eth.getBlockNumber();
        }

        const res = await secondProposer.changeCurrentProposer();
        expectTransaction(res);
        numChanges++;
      } catch (err) {
        console.log(err);
      }
    }
    expect(numChanges).to.be.equal(CHANGE_PROPOSER_NO_TIMES);
  });

  it('should unregister the second proposer', async () => {
    let proposers;
    ({ proposers } = await secondProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await secondProposer.deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await secondProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('should unregister the boot proposer', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await bootProposer.deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('should create a failing withdrawStake (because insufficient time has passed)', async () => {
    try {
      await bootProposer.withdrawStake();
      expect.fail('Withdraw stake did not fail');
    } catch (err) {
      expect(err.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  it('should create a passing withdrawStake (because sufficient time has passed)', async () => {
    const nodeInfo = await web3Client.getInfo();
    if (!nodeInfo.includes('TestRPC')) {
      logger.info('Not using a time-jump capable test client so this test is skipped');
      this.skip();
    }

    await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days
    const res = await bootProposer.withdrawStake();
    expectTransaction(res);
  });

  after(async () => {
    // After the proposer tests, unregister proposers
    await secondProposer.close();
    await bootProposer.close();
    web3Client.closeWeb3();
  });
});
