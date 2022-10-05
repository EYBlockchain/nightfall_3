/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import axios from 'axios';
import EventEmitter from 'events';
import Nf3 from '../../../cli/lib/nf3.mjs';
// import logger from '../../../common-files/utils/logger.mjs';
import { Web3Client, expectTransaction, pendingCommitmentCount } from '../../utils.mjs';

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
  // await new Promise(resolve => setTimeout(resolve, 6000));

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
  // await new Promise(resolve => setTimeout(resolve, 6000));
};

describe('Basic Proposer tests', () => {
  const proposersHttp = [
    axios.create({
      baseURL: 'http://localhost:8092',
    }),
    axios.create({
      baseURL: 'http://localhost:8093',
    }),
  ];

  proposersHttp[0].interceptors.response.use(res => res.data);
  proposersHttp[1].interceptors.response.use(res => res.data);

  const optimist = axios.create({
    baseURL: environment.optimistApiUrl,
  });
  optimist.interceptors.response.use(res => res.data);

  const client = axios.create({
    baseURL: environment.clientApiUrl,
  });
  client.interceptors.response.use(res => res.data);

  let p0Address;
  let p1Address;

  before(async () => {
    web3 = web3Client.getWeb3();
    await nf3User.init(mnemonics.user1);

    ({ address: p0Address } = await proposersHttp[0].get('/proposer'));
    ({ address: p1Address } = await proposersHttp[1].get('/proposer'));
    ({ address: stateAddress } = await optimist.get(`/contract-address/State`));
    ({ abi: stateABI } = await client.get(`/contract-abi/State`));
    ({ address: erc20Address } = await optimist.get(`/contract-address/ERC20Mock`));

    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  it('should register the boot proposer', async () => {
    const stakeAccount1 = await getStakeAccount(p0Address);
    const res = await proposersHttp[0].post('/proposer', {
      bond: MINIMUM_STAKE,
      url: testProposersUrl[0],
    });

    expect(res).to.equal('OK');
    const stakeAccount2 = await getStakeAccount(p0Address);
    const { proposers } = await proposersHttp[0].get('/proposer/all');

    const thisProposer = proposers.filter(p => p.thisAddress === p0Address);

    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  it('should allow to register a second proposer', async () => {
    const stakeAccount1 = await getStakeAccount(p1Address);
    const res = await proposersHttp[1].post('/proposer', {
      bond: MINIMUM_STAKE,
      url: testProposersUrl[0],
    });

    expect(res).to.equal('OK');
    const stakeAccount2 = await getStakeAccount(p1Address);
    const { proposers } = await proposersHttp[1].get('/proposer/all');

    const thisProposer = proposers.filter(p => p.thisAddress === p1Address);

    expect(thisProposer.length).to.be.equal(1);
    expect(Number(stakeAccount2.amount)).equal(
      Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
    );
  });

  // it('should allow to register a third proposer other than the boot proposer', async () => {
  //   const stakeAccount1 = await getStakeAccount(thirdProposer.ethereumAddress);
  //   const res = await thirdProposer.registerProposer(testProposersUrl[0], MINIMUM_STAKE);
  //   expectTransaction(res);
  //   const stakeAccount2 = await getStakeAccount(thirdProposer.ethereumAddress);
  //   const { proposers } = await thirdProposer.getProposers();
  //   const thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(1);
  //   expect(Number(stakeAccount2.amount)).equal(
  //     Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
  //   );
  // });

  it.skip('should update proposer url', async () => {
    let { proposers } = await proposersHttp[0].get('/proposer/all');

    const res = await proposersHttp[0].put('/proposer', { url: testProposersUrl[3] });

    expect(res).to.equal('OK');

    ({ proposers } = await proposersHttp[0].get('/proposer/all'));

    const thisProposer = proposers.filter(p => p.thisAddress === p0Address);
    expect(thisProposer.length).to.be.equal(1);
    expect(thisProposer[0].url).to.be.equal(testProposersUrl[3]);
  });

  it.skip('should increment the stake of the proposer', async () => {
    const initialStake = await getStakeAccount(p0Address);

    const blocks = new EventEmitter();
    web3Client
      .getWeb3()
      .eth.subscribe('newBlockHeaders')
      .on('data', () => {
        blocks.emit('newBlock');
      });

    const res = await proposersHttp[0].put('/proposer/stake', {
      url: testProposersUrl[3],
      stake: MINIMUM_STAKE,
    });
    expect(res).to.equal('OK');

    blocks.on('newBlock', async () => {
      const finalStake = await getStakeAccount(p0Address);
      expect(Number(finalStake.amount)).to.be.equal(
        Number(initialStake.amount) + Number(MINIMUM_STAKE),
      );
      blocks.removeAllListeners();
    });
  });

  it.skip('should fail to register a proposer twice', async () => {
    let error;
    try {
      await proposersHttp[1].post('/proposer', {
        bond: MINIMUM_STAKE,
        url: testProposersUrl[0],
      });
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message => message.includes('400'));
  });

  it.skip('should create a failing changeCurrentProposer (because insufficient blocks has passed)', async function () {
    let error = null;
    try {
      await proposersHttp[1].put('/proposer/change');
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message => message.includes('500'));
  });

  it('should create some blocks and increase the L2 balance', async () => {
    // await nf3User.deposit(erc20Address, tokenType, transferValue * 2, tokenId, fee);
    // await emptyL2();

    const currentZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;

    console.log(currentZkpPublicKeyBalance);
    for (let i = 0; i < txPerBlock; i++) {
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    }

    console.log('4');
    await emptyL2();

    const afterZkpPublicKeyBalance =
      (await nf3User.getLayer2Balances())[erc20Address]?.[0].balance || 0;
    console.log(afterZkpPublicKeyBalance);

    expect(afterZkpPublicKeyBalance - currentZkpPublicKeyBalance).to.be.equal(
      transferValue * txPerBlock,
    );
  });

  // it('Should create a valid changeCurrentProposer (because blocks has passed)', async function () {
  //   for (let i = 0; i < 8; i++) {
  //     try {
  //       // eslint-disable-next-line no-await-in-loop
  //       const currentSprint = await getCurrentSprint();
  //       // eslint-disable-next-line no-await-in-loop
  //       const currentProposer = await getCurrentProposer();
  //       console.log(
  //         `     [ Current sprint: ${currentSprint}, Current proposer: ${currentProposer.thisAddress} ]`,
  //       );

  //       console.log('     Waiting blocks to rotate current proposer...');
  //       const initBlock = await web3.eth.getBlockNumber();
  //       let currentBlock = initBlock;

  //       while (currentBlock - initBlock < ROTATE_PROPOSER_BLOCKS) {
  //         await new Promise(resolve => setTimeout(resolve, 10000));
  //         currentBlock = await web3.eth.getBlockNumber();
  //       }

  //       const res = await secondProposer.changeCurrentProposer();
  //       expectTransaction(res);
  //     } catch (err) {
  //       console.log(err);
  //     }
  //   }
  // });

  // it('should unregister the third proposer', async () => {
  //   let proposers;
  //   ({ proposers } = await thirdProposer.getProposers());
  //   let thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(1);
  //   const res = await thirdProposer.deregisterProposer();
  //   expectTransaction(res);
  //   ({ proposers } = await thirdProposer.getProposers());
  //   thisProposer = proposers.filter(p => p.thisAddress === thirdProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(0);
  // });

  // it('should unregister the second proposer', async () => {
  //   let proposers;
  //   ({ proposers } = await secondProposer.getProposers());
  //   let thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(1);
  //   const res = await secondProposer.deregisterProposer();
  //   expectTransaction(res);
  //   ({ proposers } = await secondProposer.getProposers());
  //   thisProposer = proposers.filter(p => p.thisAddress === secondProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(0);
  // });

  // it('should unregister the boot proposer', async () => {
  //   let proposers;
  //   ({ proposers } = await bootProposer.getProposers());
  //   let thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(1);
  //   const res = await bootProposer.deregisterProposer();
  //   expectTransaction(res);
  //   ({ proposers } = await bootProposer.getProposers());
  //   thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
  //   expect(thisProposer.length).to.be.equal(0);
  // });

  // it('Should create a failing withdrawStake (because insufficient time has passed)', async () => {
  //   let error = null;
  //   try {
  //     await bootProposer.withdrawStake();
  //   } catch (err) {
  //     error = err;
  //   }
  //   expect(error.message).to.satisfy(
  //     message =>
  //       message.includes(
  //         'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond',
  //       ) || message.includes('Transaction has been reverted by the EVM'),
  //   );
  // });

  // it('Should create a passing withdrawStake (because sufficient time has passed)', async () => {
  //   if ((await web3Client.getInfo()).includes('TestRPC')) await web3Client.timeJump(3600 * 24 * 10); // jump in time by 7 days
  //   if ((await web3Client.getInfo()).includes('TestRPC')) {
  //     const res = await bootProposer.withdrawStake();
  //     expectTransaction(res);
  //   } else {
  //     let error = null;
  //     try {
  //       await bootProposer.withdrawStake();
  //     } catch (err) {
  //       error = err;
  //     }
  //     expect(error.message).to.include('Transaction has been reverted by the EVM');
  //   }
  // });

  after(async () => {
    // After the proposer tests, unregister proposers
    await proposersHttp[0].delete('/proposer');
    await proposersHttp[1].delete('/proposer');
    web3Client.closeWeb3();
  });
});
