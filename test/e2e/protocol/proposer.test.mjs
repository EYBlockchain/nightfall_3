/* eslint-disable prefer-destructuring */
/* eslint-disable @babel/no-unused-expressions */
/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { Web3Client, pendingCommitmentCount } from '../../utils.mjs';

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

const filterByThisProposer = async nf3proposer => {
  const { proposers } = await nf3proposer.getProposers();
  return proposers.filter(p => p.thisAddress === nf3proposer.ethereumAddress);
};

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
  const feeDefault = 0;
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
    const proposersBeforeRegister = await filterByThisProposer(bootProposer);
    console.log('*************proposersBeforeRegister', proposersBeforeRegister);
    const stakeBeforeRegister = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeBeforeRegister', stakeBeforeRegister);

    // Register proposer
    const url = testProposersUrl[0];
    await bootProposer.registerProposer(url, minimumStake, feeDefault);

    // After registering proposer
    const proposersAfterRegister = await filterByThisProposer(bootProposer);
    console.log('*************proposersAfterRegister', proposersAfterRegister);
    const stakeAfterRegister = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeAfterRegister', stakeAfterRegister);

    // Assertions, before registering
    expect(proposersBeforeRegister).to.be.an('array').that.is.empty;
    // After
    expect(proposersAfterRegister).to.have.lengthOf(1);
    expect(proposersAfterRegister[0].url).to.be.equal(url);
    expect(Number(proposersAfterRegister[0].fee)).to.be.equal(feeDefault);
    const amountAfterRegister = Number(stakeBeforeRegister.amount) + Number(minimumStake);
    expect(Number(stakeAfterRegister.amount)).equal(amountAfterRegister);
  });

  it('Should update the proposer fee', async () => {
    // Before updating proposer
    const proposersBeforeUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersBeforeUpdate', proposersBeforeUpdate);
    const stakeBeforeUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeBeforeUpdate', stakeBeforeUpdate);
    expect(proposersBeforeUpdate).to.have.lengthOf(1);

    // Update proposer fee
    const currentUrl = proposersBeforeUpdate[0].url; // Need to pass current value
    const stake = 0; // Contract adds given value to existing amount
    const newFee = fee;
    await bootProposer.updateProposer(currentUrl, stake, newFee);

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersAfterUpdate', proposersAfterUpdate);
    const stakeAfterUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeAfterUpdate', stakeAfterUpdate);

    // Assertions, before updating fee
    expect(Number(proposersBeforeUpdate[0].fee)).to.be.equal(feeDefault);
    // After - url and stake remain the same
    expect(proposersAfterUpdate).to.have.lengthOf(1);
    expect(Number(proposersAfterUpdate[0].fee)).to.be.equal(newFee);

    expect(proposersAfterUpdate[0].url).to.be.equal(currentUrl);
    expect(Number(stakeAfterUpdate.amount)).to.be.equal(Number(stakeBeforeUpdate.amount));
  });

  it('Should update the proposer url', async () => {
    // Before updating proposer
    const proposersBeforeUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersBeforeUpdate', proposersBeforeUpdate);
    const stakeBeforeUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeBeforeUpdate', stakeBeforeUpdate);
    expect(proposersBeforeUpdate).to.have.lengthOf(1);

    // Update proposer url
    const newUrl = testProposersUrl[1];
    const stake = 0; // Contract adds given value to existing amount
    const currentFee = Number(proposersBeforeUpdate[0].fee); // Need to pass current value
    await bootProposer.updateProposer(newUrl, stake, currentFee);

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersAfterUpdate', proposersAfterUpdate);
    const stakeAfterUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeAfterUpdate', stakeAfterUpdate);

    // Assertions, before updating url
    expect(proposersBeforeUpdate[0].url).to.be.equal(testProposersUrl[0]);
    // After - fee and stake remain the same
    expect(proposersAfterUpdate).to.have.lengthOf(1);
    expect(proposersAfterUpdate[0].url).to.be.equal(newUrl);

    expect(Number(proposersAfterUpdate[0].fee)).to.be.equal(fee);
    expect(Number(stakeAfterUpdate.amount)).to.be.equal(Number(stakeBeforeUpdate.amount));
  });

  it('Should update the proposer stake', async () => {
    // Before updating proposer
    const proposersBeforeUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersBeforeUpdate', proposersBeforeUpdate);
    const stakeBeforeUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeBeforeUpdate', stakeBeforeUpdate);
    expect(proposersBeforeUpdate).to.have.lengthOf(1);

    // Update proposer url
    const currentUrl = proposersBeforeUpdate[0].url;
    const currentFee = Number(proposersBeforeUpdate[0].fee); // Need to pass current value
    await bootProposer.updateProposer(currentUrl, minimumStake, currentFee);

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(bootProposer);
    console.log('*************proposersAfterUpdate', proposersAfterUpdate);
    const stakeAfterUpdate = await getStakeAccount(bootProposer.ethereumAddress);
    console.log('*************stakeAfterUpdate', stakeAfterUpdate);

    // Assertions - url and fee remain the same
    expect(proposersAfterUpdate).to.have.lengthOf(1);
    const amountAfterUpdate = Number(stakeBeforeUpdate.amount) + Number(minimumStake);
    expect(Number(stakeAfterUpdate.amount)).to.be.equal(amountAfterUpdate);

    expect(proposersAfterUpdate[0].url).to.be.equal(currentUrl);
    expect(Number(proposersAfterUpdate[0].fee)).to.be.equal(currentFee);
  });

  it('Should fail to register a proposer twice', async () => {
    const res = await bootProposer.registerProposer('potato', minimumStake);
    // Registration attempt will be ignored at the endpoint since the Eth address will be the same
    expect(res.data).to.be.an('object').that.is.empty;
  });

  it.skip('Should fail to change current proposer because insufficient blocks have passed', async () => {
    // SKIP Call fails as expected but revert reason `State: Too soon to rotate proposer` is not captured
    // TODO We should be able to assert that it is actually too soon

    // Note that the test operates with one proposer, which is why we use the current proposer
    // to call `changeCurrentProposer`, in reality this proposer would be the least interested
    let error = null;
    try {
      await bootProposer.changeCurrentProposer();
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

        await bootProposer.changeCurrentProposer();
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
    await bootProposer.deregisterProposer();
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
      await bootProposer.withdrawStake();
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
