/* eslint-disable @babel/no-unused-expressions */
/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { Web3Client, expectTransaction, pendingCommitmentCount } from '../../utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  mnemonics,
  signingKeys,
  ROTATE_PROPOSER_BLOCKS,
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const eventLogs = [];
let web3;
let stateAddress;
let stateABI;

const nf3User = new Nf3(signingKeys.user1, environment);

// const CHANGE_PROPOSER_NO_TIMES = 8;

const getStakeAccount = async ethAccount => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  return stateContractInstance.methods.getStakeAccount(ethAccount).call();
};

const getCurrentProposer = async () => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  return stateContractInstance.methods.getCurrentProposer().call();
};

// const getProposer = async proposerAddress => {
//   const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
//   return stateContractInstance.methods.getProposer(proposerAddress).call();
// };

const getCurrentSprint = async () => {
  const stateContractInstance = new web3.eth.Contract(stateABI, stateAddress);
  return stateContractInstance.methods.currentSprint().call();
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
  const bootProposer = new Nf3(signingKeys.proposer1, environment);
  const testProposersUrl = ['http://test-proposer1', 'http://test-proposer2'];
  let minimumStake;
  let erc20Address;

  before(async () => {
    web3 = web3Client.getWeb3();
    await nf3User.init(mnemonics.user1);
    await bootProposer.init(mnemonics.proposer);
    // await secondProposer.init(mnemonics.proposer);
    // await thirdProposer.init(mnemonics.proposer);

    minimumStake = await bootProposer.getMinimumStake();
    console.log('*************minimumStake', minimumStake);
    stateAddress = await bootProposer.getContractAddress('State');
    console.log('*************stateAddress', stateAddress);
    stateABI = await bootProposer.getContractAbi('State');
    erc20Address = await bootProposer.getContractAddress('ERC20Mock');
    console.log('*************erc20Address', erc20Address);
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  it('Should register the boot proposer', async () => {
    // Before registering proposer
    const stakeAccount1 = await getStakeAccount(bootProposer.ethereumAddress);
    let result = await bootProposer.getProposers();
    const proposersBeforeRegister = result.proposers.filter(
      p => p.thisAddress === bootProposer.ethereumAddress,
    );

    // Register proposer
    await bootProposer.registerProposer(testProposersUrl[0], minimumStake);

    // After registering proposer
    const stakeAccount2 = await getStakeAccount(bootProposer.ethereumAddress);
    result = await bootProposer.getProposers();
    const proposersAfterRegister = result.proposers.filter(
      p => p.thisAddress === bootProposer.ethereumAddress,
    );

    // Assertions before registering
    // expect(Number(stakeAccount1.amount)).to.be.equal(0); // Fails when not running with clean nf
    expect(proposersBeforeRegister).to.be.an('array').that.is.empty;

    // Assertions after registering
    expect(Number(stakeAccount2.amount)).equal(Number(stakeAccount1.amount) + Number(minimumStake));
    expect(proposersAfterRegister).to.have.lengthOf(1);
  });

  it.skip('Should update the proposer url', async () => {
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

  it.skip('Should update the proposer stake', async () => {
    const initialStake = await getStakeAccount(bootProposer.ethereumAddress);
    const res = await bootProposer.updateProposer(testProposersUrl[0], minimumStake, 0);
    expectTransaction(res);
    const finalStake = await getStakeAccount(bootProposer.ethereumAddress);
    expect(Number(finalStake.amount)).to.be.equal(
      Number(initialStake.amount) + Number(minimumStake),
    );
  });

  it.skip('Should update the proposer fee', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay stake to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3], 0, fee);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(Number(thisProposer[0].fee)).to.be.equal(fee);
  });

  it.skip('Should fail to register a proposer twice', async () => {
    const res = await bootProposer.registerProposer(testProposersUrl[2], minimumStake);
    expect(res).to.be.false;
  });

  it.skip('Should fail to change current proposer because insufficient blocks have passed', async () => {
    let error = null;
    try {
      // const res = await secondProposer.changeCurrentProposer();
      const res = await bootProposer.changeCurrentProposer();
      expectTransaction(res);
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(message =>
      message.includes('Transaction has been reverted by the EVM'),
    );
  });

  it.skip('Should create some blocks and increase the L2 balance', async () => {
    await bootProposer.startProposer(); // start proposer to listen making blocks

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

  it.skip('Should change the current proposer', async function () {
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

        const res = await bootProposer.changeCurrentProposer();
        expectTransaction(res);
        // numChanges++;
      } catch (err) {
        console.log(err);
      }
    }
    // expect(numChanges).to.be.equal(CHANGE_PROPOSER_NO_TIMES);
  });

  it.skip('Should unregister the boot proposer', async () => {
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

  it.skip('Should fail to withdraw stake due to the cooling off period', async () => {
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

  it.skip('Should be able to withdraw stake', async () => {
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
    await bootProposer.close();
    web3Client.closeWeb3();
  });
});
