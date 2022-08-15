/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import logger from '../../../common-files/utils/logger.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  // txPerBlock,
  mnemonics,
  signingKeys,
  // tokenConfigs: { tokenType, tokenId },
  // transferValue,
  // fee,
} = config.TEST_OPTIONS;

const bootProposer = new Nf3(signingKeys.proposer1, environment);
const testProposer = new Nf3(signingKeys.proposer2, environment);

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

// const totalDeposits = txPerBlock * 3;
const nf3User = new Nf3(signingKeys.user1, environment);
// let erc20Address;
// let stateAddress;
// let eventLogs = [];

const web3Client = new Web3Client();

describe('Basic Proposer tests', () => {
  before(async () => {
    await nf3User.init(mnemonics.user1);
    // erc20Address = await nf3User.getContractAddress('ERC20Mock');
    // stateAddress = await nf3User.stateContractAddress;
    // web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await bootProposer.init(mnemonics.proposer);
    await testProposer.init(mnemonics.proposer);
    // Proposer registration
    await bootProposer.registerProposer(testProposersUrl[0]);
    const blockProposeEmitter = await bootProposer.startProposer();
    blockProposeEmitter
      .on('receipt', (receipt, block) => {
        logger.debug(
          `L2 Block with L2 block number ${block.blockNumberL2} was proposed. The L1 transaction hash is ${receipt.transactionHash}`,
        );
      })
      .on('error', (error, block) => {
        logger.error(
          `Proposing L2 Block with L2 block number ${block.blockNumberL2} failed due to error: ${error} `,
        );
      });
  });

  it('should fail to register a proposer other than the boot proposer', async () => {
    try {
      const res = await testProposer.registerProposer(testProposersUrl[1]);
      expectTransaction(res);
    } catch (error) {
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    }
  });

  it('should update proposers url', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay 10 ETH to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3]);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(proposers[0].url).to.be.equal(testProposersUrl[3]);
  });

  it('should fail to register a proposer twice', async () => {
    const res = await bootProposer.registerProposer(testProposersUrl[2]);
    // eslint-disable-next-line @babel/no-unused-expressions
    expect(res).to.be.false;
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

  it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
    let error = null;
    try {
      await bootProposer.withdrawBond();
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

  it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
    if ((await web3Client.getInfo()).includes('TestRPC')) await web3Client.timeJump(3600 * 24 * 10); // jump in time by 7 days
    if ((await web3Client.getInfo()).includes('TestRPC')) {
      const res = await bootProposer.withdrawBond();
      expectTransaction(res);
    } else {
      let error = null;
      try {
        await bootProposer.withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  after(async () => {
    // After the proposer tests, unregister proposers
    await testProposer.close();
    await bootProposer.close();
    web3Client.closeWeb3();
  });
});
