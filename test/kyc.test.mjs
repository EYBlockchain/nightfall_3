/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../cli/lib/nf3.mjs';
import { expectTransaction, Web3Client } from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  MINIMUM_STAKE,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];

describe('KYC tests', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    // we must set the URL from the point of view of the client container
    await nf3Proposer.registerProposer('http://optimist1', MINIMUM_STAKE);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    await web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    logger.debug(`User[0] has ethereum address ${nf3Users[0].ethereumAddress}`);
    // start with the user delisted (they should be anyway)
    try {
      await nf3Users[0].removeUserFromWhitelist(nf3Users[0].ethereumAddress);
    } catch (err) {
      logger.debug('user was already delisted');
    }
  });

  describe('Deposits from a non-whitelisted then whitelisted account', () => {
    it('deposits from a non-whitelisted should revert', async function () {
      logger.debug('Remove user from whitelist, they probably already are');
      // logger.debug('waiting');
      // await new Promise(resolve => setTimeout(resolve, 30000));
      expect(await nf3Users[0].isWhitelisted(nf3Users[0].ethereumAddress)).to.equal(false);
      logger.debug('Send failing deposit');
      let error;
      try {
        await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    });
    it('whitelist the account', async function () {
      logger.debug('Check whitelist status');
      expect(await nf3Users[0].isWhitelisted(nf3Users[0].ethereumAddress)).to.be.equal(false);
      // nf3Users[0] is a whitelist manager (set up config) and so can whitelist themselves to group 1
      await nf3Users[0].addUserToWhitelist(1, nf3Users[0].ethereumAddress);
      expect(await nf3Users[0].isWhitelisted(nf3Users[0].ethereumAddress)).to.be.equal(true);
    });
    it('deposits from  a whitelisted account should work', async function () {
      logger.debug('doing whitelisted account');
      const res = await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      logger.debug('Working deposit done');
    });
  });

  describe('Withdrawals from a non-whitelisted then whitelisted account', () => {
    let withdrawal;
    let nodeInfo;
    before(async function () {
      nodeInfo = await web3Client.getInfo();
      if (!nodeInfo.includes('TestRPC')) this.skip(); // only works with timejump clients
      logger.debug('Sending withdraw transaction');
      await nf3Users[0].withdraw(
        false,
        erc20Address,
        tokenType,
        Math.floor(transferValue / 2),
        tokenId,
        nf3Users[0].ethereumAddress,
        fee,
      );
      logger.debug('Getting withdrawal hash');
      withdrawal = await nf3Users[0].getLatestWithdrawHash();
      await nf3Users[0].makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      // timejump is the client supports it (basically Ganache)
      await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days
    });

    it('Should remove the whitelisting and revert', async function () {
      if (!nodeInfo.includes('TestRPC')) this.skip(); // only works with timejump clients
      logger.debug('Removing user from whitelist');
      await nf3Users[0].removeUserFromWhitelist(nf3Users[0].ethereumAddress);
      expect(await nf3Users[0].isWhitelisted(nf3Users[0].ethereumAddress)).to.equal(false);
      let error;
      try {
        logger.debug('Finalising withdrawal');
        await nf3Users[0].finaliseWithdrawal(withdrawal);
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    });

    it('Should add the whitelisting and succeed', async function () {
      if (!nodeInfo.includes('TestRPC')) this.skip();
      await nf3Users[0].addUserToWhitelist(1, nf3Users[0].ethereumAddress);
      const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
      expectTransaction(res);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
