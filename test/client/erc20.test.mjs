/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../cli/lib/nf3.mjs';
import { expectTransaction, depositNTransactions, Web3Client } from '../utils.mjs';
import logger from '../../common-files/utils/logger.mjs';

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
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];

describe('ERC20 tests', () => {
  before(async () => {
    console.log('ENV', environment);
    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    erc20Address = '0x499d11e0b6eac7c0593d8fb292dcbbf815fb29ae'; // MATIC

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    it('should increment the balance after deposit some ERC20 crypto', async function () {
      const currentPkdBalance = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      logger.info(`Initial balance: ${currentPkdBalance}`);
      // We do txPerBlock deposits of 10 each
      await depositNTransactions(
        nf3Users[0],
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      const afterPkdBalance = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      logger.info(`Final balance: ${afterPkdBalance}`);
      expect(afterPkdBalance).to.be.greaterThan(currentPkdBalance);
    });
  });

  describe('Transfers', () => {
    it('should send a single ERC20 transfer directly to a proposer', async function () {
      const before = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;

      const res = await nf3Users[0].transfer(
        true,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[1].zkpKeys.compressedPkd,
        fee,
      );
      expect(res).to.be.equal(200);

      const after = (await nf3Users[0].getLayer2Balances())[erc20Address][0].balance;
      expect(after).to.be.lessThan(before);
    });
  });

  describe('Normal withdraws from L2', () => {
    it('should withdraw from L2, checking for missing commitment', async function () {
      const beforeBalance = (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance;
      const rec = await nf3Users[0].withdraw(
        true,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].ethereumAddress,
      );
      expect(rec).to.be.equal(200);

      logger.debug(`     Gas used was ${Number(rec.gasUsed)}`);
      const afterBalance = (await nf3Users[0].getLayer2Balances())[erc20Address]?.[0].balance;
      expect(afterBalance).to.be.lessThan(beforeBalance);
    });
  });

  after(async () => {
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
