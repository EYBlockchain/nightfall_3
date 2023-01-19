/* eslint-disable prefer-destructuring */
/* eslint-disable @babel/no-unused-expressions */
/* eslint-disable no-await-in-loop */
import axios from 'axios';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { getLayer2Balances, Web3Client } from '../../utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { PROPOSERS_CONTRACT_NAME, STATE_CONTRACT_NAME } = constants;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  fee,
  transferValue,
} = config.TEST_OPTIONS;

axios.defaults.headers.common['X-APP-TOKEN'] = environment.AUTH_TOKEN;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const { optimistApiUrl } = environment;
const proposerPrivateKey = environment.PROPOSER_KEY;
const proposerAddress = web3Client.getEthAddressFromPrivateKey(proposerPrivateKey);

const getContractInstance = async (contractName, contractAddress) => {
  const abi = await nf3User.getContractAbi(contractName);
  const contractInstance = new nf3User.web3.eth.Contract(abi, contractAddress);
  return contractInstance;
};

const getCurrentProposer = async () => {
  const { currentProposer } = (await axios.get(`${optimistApiUrl}/proposer/current-proposer`)).data;
  return currentProposer;
};

const getMinimumStake = async stateAddress => {
  const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME, stateAddress);
  return stateContractInstance.methods.getMinimumStake().call();
};

const getStakeAccount = async () => {
  return (await axios.get(`${optimistApiUrl}/proposer/stake`)).data;
};

const filterByThisProposer = async _proposerAddress => {
  const { proposers } = (await axios.get(`${optimistApiUrl}/proposer/proposers`)).data;
  return proposers.filter(p => p.thisAddress === _proposerAddress);
};

describe('Basic Proposer tests', () => {
  const testProposersUrl = ['http://test-proposer1', 'http://test-proposer2'];
  const feeDefault = 0;

  let minimumStake;
  let stateAddress;
  let proposersAddress;
  let erc20Address;

  before(async () => {
    await nf3User.init(mnemonics.user1);

    stateAddress = await nf3User.getContractAddress(STATE_CONTRACT_NAME);
    proposersAddress = await nf3User.getContractAddress(PROPOSERS_CONTRACT_NAME);
    erc20Address = await nf3User.getContractAddress('ERC20Mock');

    minimumStake = await getMinimumStake(stateAddress);

    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: proposersAddress });
  });

  it('Should access any public route with any API key', async () => {
    delete axios.defaults.headers.common['X-APP-TOKEN'];
    const { status } = await axios.get(`${environment.optimistApiUrl}/proposer/mempool`);
    expect(status).to.equal(200);
  });

  it('Should access any public route with the correct API key', async () => {
    axios.defaults.headers.common['X-APP-TOKEN'] = environment.AUTH_TOKEN;
    const { status } = await axios.get(`${environment.optimistApiUrl}/proposer/mempool`);
    expect(status).to.equal(200);
  });

  it('Should fail to register a proposer without an API key', async () => {
    try {
      delete axios.defaults.headers.common['X-APP-TOKEN'];
      await axios.post(`${optimistApiUrl}/proposer/register`, {
        url: optimistApiUrl,
        stake: minimumStake,
      });
      expect.fail('Register proposer did not fail');
    } catch (err) {
      expect(err.response).to.have.property('status', 401);
    }
  });

  it('Should fail to register a proposer without a valid API key', async () => {
    try {
      axios.defaults.headers.common['X-APP-TOKEN'] = 'test';
      await axios.post(`${optimistApiUrl}/proposer/register`, {
        url: optimistApiUrl,
        stake: minimumStake,
      });
      expect.fail('Register proposer did not fail');
    } catch (err) {
      expect(err.response).to.have.property('status', 401);
    }
  });

  it('Should register a proposer, then wait for this to become current', async () => {
    // Before registering proposer
    axios.defaults.headers.common['X-APP-TOKEN'] = environment.AUTH_TOKEN;
    const proposersBeforeRegister = await filterByThisProposer(proposerAddress);
    const stakeBeforeRegister = await getStakeAccount();

    // Register proposer, wait for proposer to become current proposer
    const url = testProposersUrl[0];
    await axios.post(`${optimistApiUrl}/proposer/register`, {
      url,
      stake: minimumStake,
    });
    await web3Client.waitForEvent(eventLogs, ['NewCurrentProposer']);

    // After registering proposer
    const proposersAfterRegister = await filterByThisProposer(proposerAddress);
    const stakeAfterRegister = await getStakeAccount();

    // Assertions, before registering
    expect(proposersBeforeRegister).to.be.an('array').that.is.empty;
    // After
    expect(proposersAfterRegister).to.have.lengthOf(1);

    expect(proposersAfterRegister[0].url).to.be.equal(url);
    expect(Number(proposersAfterRegister[0].fee)).to.be.equal(feeDefault);

    const amountAfterRegister = Number(stakeBeforeRegister.amount) + Number(minimumStake);
    expect(Number(stakeAfterRegister.amount)).equal(amountAfterRegister);
  });

  it('Should return registered proposer as current proposer', async () => {
    const currentProposer = await getCurrentProposer();
    expect(currentProposer).to.be.equal(proposerAddress);
  });

  it('Should ignore an attempt to register a proposer twice', async () => {
    const res = await axios.post(`${optimistApiUrl}/proposer/register`, {
      url: 'potato',
      stake: minimumStake,
    });
    // Registration attempt ignored at the endpoint since the Eth address is the same
    expect(res.data).to.be.an('object').that.is.empty;
  });

  it('Should fail to change current proposer because insufficient blocks have passed', async () => {
    const currentProposerBefore = await getCurrentProposer();

    try {
      await axios.get(`${optimistApiUrl}/proposer/change`);
      expect.fail('Change proposer did not fail');
    } catch (err) {
      expect(err.response).to.have.property('status', 500);
    }

    const currentProposerAfter = await getCurrentProposer();
    expect(currentProposerAfter).to.be.equal(currentProposerBefore);
  });

  it('Should update the proposer fee', async () => {
    // Before updating proposer
    const proposersBeforeUpdate = await filterByThisProposer(proposerAddress);
    const stakeBeforeUpdate = await getStakeAccount();
    expect(proposersBeforeUpdate).to.have.lengthOf(1); // Leave here to safely access array by idx

    // Update proposer fee
    const currentUrl = proposersBeforeUpdate[0].url; // Need to pass current value
    const stake = 0; // Contract adds given value to existing amount
    const newFee = fee;
    await axios.post(`${optimistApiUrl}/proposer/update`, {
      url: currentUrl,
      stake,
      fee: newFee,
    });

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(proposerAddress);
    const stakeAfterUpdate = await getStakeAccount();

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
    const proposersBeforeUpdate = await filterByThisProposer(proposerAddress);
    const stakeBeforeUpdate = await getStakeAccount();
    expect(proposersBeforeUpdate).to.have.lengthOf(1); // Leave here to safely access array by idx

    // Update proposer url
    const newUrl = testProposersUrl[1];
    const stake = 0; // Contract adds given value to existing amount
    const currentFee = Number(proposersBeforeUpdate[0].fee); // Need to pass current value
    await axios.post(`${optimistApiUrl}/proposer/update`, {
      url: newUrl,
      stake,
      fee: currentFee,
    });

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(proposerAddress);
    const stakeAfterUpdate = await getStakeAccount();

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
    const proposersBeforeUpdate = await filterByThisProposer(proposerAddress);
    const stakeBeforeUpdate = await getStakeAccount();
    expect(proposersBeforeUpdate).to.have.lengthOf(1); // Leave here to safely access array by idx

    // Update proposer url
    const currentUrl = proposersBeforeUpdate[0].url;
    const currentFee = Number(proposersBeforeUpdate[0].fee); // Need to pass current value
    await axios.post(`${optimistApiUrl}/proposer/update`, {
      url: currentUrl,
      stake: minimumStake,
      fee: currentFee,
    });

    // After updating proposer
    const proposersAfterUpdate = await filterByThisProposer(proposerAddress);
    const stakeAfterUpdate = await getStakeAccount();

    // Assertions - url and fee remain the same
    expect(proposersAfterUpdate).to.have.lengthOf(1);

    const amountAfterUpdate = Number(stakeBeforeUpdate.amount) + Number(minimumStake);
    expect(Number(stakeAfterUpdate.amount)).to.be.equal(amountAfterUpdate);

    expect(proposersAfterUpdate[0].url).to.be.equal(currentUrl);
    expect(Number(proposersAfterUpdate[0].fee)).to.be.equal(currentFee);
  });

  it('Should be able to make a block any time as soon as there are txs in the mempool', async () => {
    // User balance in L2 before making deposit
    const balancesBeforeBlockProposed = await getLayer2Balances(nf3User, erc20Address);

    // Make deposit, then make block to settle the deposit
    const value = String(transferValue * 2);
    await nf3User.deposit(erc20Address, tokenType, value, tokenId, fee);
    await axios.get(`${optimistApiUrl}/block/make-now`);

    // Wait before checking user balance in L2 again
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    const balancesAfterBlockProposed = await getLayer2Balances(nf3User, erc20Address);

    // Assertions
    expect(balancesAfterBlockProposed).to.be.above(balancesBeforeBlockProposed);
  });

  it('Should de-register the proposer even when it is current proposer', async () => {
    // Before de-registering proposer
    const proposersBeforeDeregister = await filterByThisProposer(proposerAddress);
    const currentProposer = await getCurrentProposer();

    // De-register proposer
    await axios.post(`${optimistApiUrl}/proposer/de-register`);
    await web3Client.waitForEvent(eventLogs, ['NewCurrentProposer']);

    // After de-registering proposer
    const proposersAfterDeregister = await filterByThisProposer(proposerAddress);

    // Assertions, before de-registering
    expect(proposersBeforeDeregister).to.have.lengthOf(1);
    expect(currentProposer).to.be.equal(proposerAddress);
    // After
    expect(proposersAfterDeregister).to.be.an('array').that.is.empty;
  });

  it('Should return default 0x0..0 as current proposer', async () => {
    const currentProposer = await getCurrentProposer();
    expect(currentProposer).to.have.string('0x0');
  });

  it('Should fail to withdraw stake due to the cooling off period', async () => {
    const stakeBeforeWithdrawal = await getStakeAccount();

    try {
      await axios.post(`${optimistApiUrl}/proposer/withdrawStake`);
      expect.fail('Withdraw stake did not fail');
    } catch (err) {
      expect(err.response).to.have.property('status', 500);
    }

    const stakeAfterWithdrawal = await getStakeAccount();
    expect(stakeAfterWithdrawal.amount).to.be.equal(stakeBeforeWithdrawal.amount);
  });

  it('Should be able to withdraw stake', async () => {
    const nodeInfo = await web3Client.getInfo();
    if (!nodeInfo.includes('TestRPC')) {
      logger.info('Not using a time-jump capable test client so this test is skipped');
      this.skip();
    }

    const stakeBeforeWithdrawal = await getStakeAccount();
    await web3Client.timeJump(3600 * 24 * 10);

    await axios.post(`${optimistApiUrl}/proposer/withdrawStake`);

    const stakeAfterWithdrawal = await getStakeAccount();
    expect(stakeBeforeWithdrawal.amount).to.not.equal(0);
    expect(stakeAfterWithdrawal.amount).to.equal(0);
  });

  after(async () => {
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
