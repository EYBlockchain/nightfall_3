/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
// import logger from '../../../common-files/utils/logger.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, MINIMUM_STAKE, ROTATE_PROPOSER_BLOCKS } = config.TEST_OPTIONS;

const bootProposer = new Nf3(signingKeys.proposer1, environment);
const secondProposer = new Nf3(signingKeys.proposer2, environment);
const thirdProposer = new Nf3(signingKeys.proposer3, environment);

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

const nf3User = new Nf3(signingKeys.user1, environment);

const web3Client = new Web3Client();
let web3;

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
  {
    inputs: [],
    name: 'getCurrentProposer',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'thisAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'previousAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'nextAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'url',
            type: 'string',
          },
        ],
        internalType: 'struct Structures.LinkedAddress',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'currentSprint',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'addr',
        type: 'address',
      },
    ],
    name: 'getProposer',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'thisAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'previousAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'nextAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'url',
            type: 'string',
          },
        ],
        internalType: 'struct Structures.LinkedAddress',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

let stateAddress;

const getStakeAccount = async ethAccount => {
  const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
  const stakeAccount = await stateContractInstance.methods.getStakeAccount(ethAccount).call();
  return stakeAccount;
};

const getCurrentProposer = async () => {
  const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
  const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
  return currentProposer;
};

const getProposer = async proposerAddress => {
  const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
  const currentProposer = await stateContractInstance.methods.getProposer(proposerAddress).call();
  return currentProposer;
};

const getCurrentSprint = async () => {
  const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
  const currentSprint = await stateContractInstance.methods.currentSprint().call();
  return currentSprint;
};

describe('Basic Proposer tests', () => {
  before(async () => {
    web3 = web3Client.getWeb3();
    await nf3User.init(mnemonics.user1);

    await bootProposer.init(mnemonics.proposer);
    await secondProposer.init(mnemonics.proposer);
    await thirdProposer.init(mnemonics.proposer);

    stateAddress = await bootProposer.getContractAddress('State');

    let proposer = await getProposer(secondProposer.ethereumAddress);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      console.log('De-register second proposer...');
      try {
        await secondProposer.deregisterProposer();
      } catch (e) {
        console.log(e);
      }
    }

    proposer = await getProposer(thirdProposer.ethereumAddress);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      console.log('De-register third proposer...');
      try {
        await secondProposer.deregisterProposer();
      } catch (e) {
        console.log(e);
      }
    }

    proposer = await getProposer(bootProposer.ethereumAddress);
    if (proposer.thisAddress !== '0x0000000000000000000000000000000000000000') {
      console.log('De-register boot proposer...');
      try {
        await bootProposer.deregisterProposer();
      } catch (e) {
        console.log(e);
      }
    }
  });

  it('should register the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(bootProposer.ethereumAddress);
    const res = await bootProposer.registerProposer(testProposersUrl[0], MINIMUM_STAKE);
    expectTransaction(res);
    const stakeAccount2 = await getStakeAccount(bootProposer.ethereumAddress);
    const { proposers } = await bootProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should allow to register a second proposer other than the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(secondProposer.ethereumAddress);
    const res = await secondProposer.registerProposer(testProposersUrl[0], MINIMUM_STAKE);
    expectTransaction(res);
    const stakeAccount2 = await getStakeAccount(secondProposer.ethereumAddress);
    const { proposers } = await secondProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should allow to register a third proposer other than the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(thirdProposer.ethereumAddress);
    const res = await thirdProposer.registerProposer(testProposersUrl[0], MINIMUM_STAKE);
    expectTransaction(res);
    const stakeAccount2 = await getStakeAccount(thirdProposer.ethereumAddress);
    const { proposers } = await thirdProposer.getProposers();
    const thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should update proposer url', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay stake to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3], 0);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(thisProposer[0].url).to.be.equal(testProposersUrl[3]);
  });

  it('should increment the stake of the proposer', async () => {
    const initialStake = await getStakeAccount(bootProposer.ethereumAddress);
    const res = await bootProposer.updateProposer(testProposersUrl[0], MINIMUM_STAKE);
    expectTransaction(res);
    const finalStake = await getStakeAccount(bootProposer.ethereumAddress);
    expect(Number(finalStake.amount)).to.be.equal(
      Number(initialStake.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should fail to register a proposer twice', async () => {
    const res = await bootProposer.registerProposer(testProposersUrl[2], MINIMUM_STAKE);
    // eslint-disable-next-line @babel/no-unused-expressions
    expect(res).to.be.false;
  });

  it('should create a failing changeCurrentProposer (because insufficient blocks has passed)', async function () {
    let error = null;
    try {
      const res = await secondProposer.changeCurrentProposer();
      expectTransaction(res);
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message =>
      message.includes('Transaction has been reverted by the EVM'),
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
        expectTransaction(res);
      } catch (err) {
        console.log(err);
      }
    }
  });

  it('should unregister the third proposer', async () => {
    const currentProposer = await getCurrentProposer();
    console.log('currentProposer', currentProposer);
    await new Promise(resolve => setTimeout(resolve, 10000));
    let proposers;
    ({ proposers } = await thirdProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await thirdProposer.deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await thirdProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('should unregister the second proposer', async () => {
    const currentProposer = await getCurrentProposer();
    console.log('currentProposer', currentProposer);
    await new Promise(resolve => setTimeout(resolve, 10000));
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
    const currentProposer = await getCurrentProposer();
    console.log('currentProposer', currentProposer);
    await new Promise(resolve => setTimeout(resolve, 10000));
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
      expectTransaction(res);
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
    await thirdProposer.close();
    await secondProposer.close();
    await bootProposer.close();
    web3Client.closeWeb3();
  });
});
