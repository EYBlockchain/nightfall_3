/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
// import logger from '../../../common-files/utils/logger.mjs';
import { Web3Client, expectTransaction, pendingCommitmentCount } from '../../utils.mjs';
import Proposer from '../../../optimist-sdk/dist/esm/src/libs/nightfall/proposer.js';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  mnemonics,
  signingKeys,
  MINIMUM_STAKE,
  ROTATE_PROPOSER_BLOCKS,
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
} = config.TEST_OPTIONS;

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

const bootProposer = new Proposer({
  environment,
  privateKey: signingKeys.proposer1,
  url: testProposersUrl[0],
});

const secondProposer = new Proposer({
  environment,
  privateKey: signingKeys.proposer2,
  url: testProposersUrl[0],
});

const thirdProposer = new Proposer({
  environment,
  privateKey: signingKeys.proposer3,
  url: testProposersUrl[0],
});

const nf3User = new Nf3(signingKeys.user1, environment);

const web3Client = new Web3Client();
let web3;

let stateABI;
let stateAddress;
const eventLogs = [];
let erc20Address;

const getStakeAccount = async ethAccount => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  const stakeAccount = await stateContractInstance.methods.getStakeAccount(ethAccount).call();
  return stakeAccount;
};

const getCurrentProposer = async () => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
  return currentProposer;
};

const getProposer = async proposerAddress => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  const currentProposer = await stateContractInstance.methods.getProposer(proposerAddress).call();
  return currentProposer;
};

const getCurrentSprint = async () => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  const currentSprint = await stateContractInstance.methods.currentSprint().call();
  return currentSprint;
};

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

describe('Basic Proposer tests', () => {
  before(async () => {
    web3 = web3Client.getWeb3();
    await nf3User.init(mnemonics.user1);

    await bootProposer.init();
    await secondProposer.init();
    await thirdProposer.init();

    stateAddress = await nf3User.getContractAddress('State');
    stateABI = await nf3User.getContractAbi('State');
    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    let proposer = await getProposer(secondProposer.address);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        await secondProposer.unregisterProposer();
      } catch (e) {
        // console.log(e);
      }
    }

    proposer = await getProposer(thirdProposer.address);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        await thirdProposer.unregisterProposer();
      } catch (e) {
        // console.log(e);
      }
    }

    proposer = await getProposer(bootProposer.address);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        await bootProposer.unregisterProposer();
      } catch (e) {
        // console.log(e);
      }
    }
  });

  it('should register the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(bootProposer.address);
    const res = await bootProposer.registerProposer({
      stake: MINIMUM_STAKE,
    });

    const stakeAccount2 = await getStakeAccount(bootProposer.address);
    const { proposers } = await bootProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should allow to register a second proposer other than the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(secondProposer.address);
    const res = await secondProposer.registerProposer({
      stake: MINIMUM_STAKE,
    });

    const stakeAccount2 = await getStakeAccount(secondProposer.address);
    const { proposers } = await secondProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === secondProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it.skip('should allow to register a third proposer other than the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(thirdProposer.address);
    const res = await thirdProposer.registerProposer({
      stake: MINIMUM_STAKE,
    });

    const stakeAccount2 = await getStakeAccount(thirdProposer.address);
    const { proposers } = await thirdProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it.skip('should update proposer url', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay stake to be registered
    const res = await bootProposer.updateProposer({ url: testProposersUrl[3] });

    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    expect(thisProposer[0].url).to.be.equal(testProposersUrl[3]);
  });

  it.skip('should increment the stake of the proposer', async () => {
    const initialStake = await getStakeAccount(bootProposer.address);
    const res = await bootProposer.increaseStake({ stake: MINIMUM_STAKE });

    const finalStake = await getStakeAccount(bootProposer.address);
    expect(Number(finalStake.amount)).to.be.equal(
      Number(initialStake.amount) + Number(MINIMUM_STAKE),
    );
  });

  it.skip('should fail to register a proposer twice', async () => {
    let error = null;
    try {
      const res = await bootProposer.registerProposer({
        url: testProposersUrl[2],
        stake: MINIMUM_STAKE,
      });
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message =>
      message.includes('Transaction has been reverted by the EVM'),
    );
  });

  it.skip('should create a failing changeCurrentProposer (because insufficient blocks has passed)', async function () {
    let error = null;
    try {
      const res = await secondProposer.changeCurrentProposer();
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message =>
      message.includes('Transaction has been reverted by the EVM'),
    );
  });

  it.skip('should create some blocks and increase the L2 balance', async () => {
    bootProposer.start();
    await nf3User.deposit(erc20Address, tokenType, transferValue * 2, tokenId, fee);
    await emptyL2();

    const currentZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;

    for (let i = 0; i < txPerBlock; i++) {
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    }

    await emptyL2();

    const afterZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;
    expect(afterZkpPublicKeyBalance - currentZkpPublicKeyBalance).to.be.equal(
      transferValue * txPerBlock,
    );
  });

  it('Should create a valid changeCurrentProposer (because blocks has passed)', async function () {
    for (let i = 0; i < 8; i++) {
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

        while (currentBlock - initBlock < ROTATE_PROPOSER_BLOCKS) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          currentBlock = await web3.eth.getBlockNumber();
        }

        const res = await secondProposer.changeCurrentProposer();
      } catch (err) {
        console.log(err);
      }
    }
  });

  it('should unregister the third proposer', async () => {
    let proposers;
    ({ proposers } = await thirdProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    const res = await thirdProposer.unregisterProposer();

    ({ proposers } = await thirdProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.address);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('should unregister the second proposer', async () => {
    let proposers;
    ({ proposers } = await secondProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === secondProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    const res = await secondProposer.unregisterProposer();

    ({ proposers } = await secondProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === secondProposer.address);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('should unregister the boot proposer', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === bootProposer.address);
    expect(thisProposer.length).to.be.equal(1);
    const res = await bootProposer.unregisterProposer();

    ({ proposers } = await bootProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === bootProposer.address);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('Should create a failing withdrawStake (because insufficient time has passed)', async () => {
    let error = null;
    try {
      await bootProposer.withdrawStake();
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(
      message =>
        message.includes(
          'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond',
        ) || message.includes('Transaction has been reverted by the EVM'),
    );
  });

  it('Should create a passing withdrawStake (because sufficient time has passed)', async () => {
    if ((await web3Client.getInfo()).includes('TestRPC')) await web3Client.timeJump(3600 * 24 * 10); // jump in time by 7 days
    if ((await web3Client.getInfo()).includes('TestRPC')) {
      const res = await bootProposer.withdrawStake();
    } else {
      let error = null;
      try {
        await bootProposer.withdrawStake();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  after(async () => {
    // After the proposer tests, unregister proposers
    await thirdProposer.unregisterProposer();
    await secondProposer.unregisterProposer();
    await bootProposer.unregisterProposer();
    web3Client.closeWeb3();
  });
});
