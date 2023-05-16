/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from 'common-files/classes/nf3.mjs';
import { emptyL2, expectTransaction, Web3Client } from './utils.mjs';
import { signEthereumAddress } from './unit/utils/x509.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const {
  RESTRICTIONS: {
    tokens: { [process.env.ETH_NETWORK || 'blockchain']: maxWithdrawValue },
  },
} = config;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
const eventLogs = [];
const intermediateCaCert = fs.readFileSync(
  'test/unit/utils/mock_certs/Nightfall_Intermediate_CA.cer',
);
const endUserCert = fs.readFileSync('test/unit/utils/mock_certs/Nightfall_end_user_policies.cer');
const derPrivateKey = fs.readFileSync('test/unit/utils/mock_certs/Nightfall_end_user_policies.der');

describe('x509 tests', () => {
  before(async () => {
    // first, we need to authorise the proposer
    await nf3Proposer.init(mnemonics.proposer);
    logger.debug('Validating intermediate CA cert');
    await nf3Proposer.validateCertificate(intermediateCaCert, null, false, false, 0, 0);
    await nf3Proposer.validateCertificate(
      endUserCert,
      signEthereumAddress(derPrivateKey, nf3Proposer.ethereumAddress),
      true,
      false,
      0,
      nf3Proposer.ethereumAddress,
    );
    // we must set the URL from the point of view of the client container
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());
    await nf3Proposer.startProposer();
    await nf3Users[0].init(mnemonics.user1);
    erc20Address =
      maxWithdrawValue.find(e => e.name === process.env.ERC20_COIN)?.address.toLowerCase() ||
      (await nf3Users[0].getContractAddress('ERC20Mock'));
    stateAddress = await nf3Users[0].stateContractAddress;
    await web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    logger.debug(`User[0] has ethereum address ${nf3Users[0].ethereumAddress}`);
  });

  describe('Deposits from a non-x509-validated then x509-validated account', () => {
    it('deposits from a non-x509-validated account should revert', async function () {
      // skip this if running on a proper chain as result is not idempotent
      const nodeInfo = await web3Client.getInfo();
      if (!nodeInfo.includes('TestRPC')) {
        logger.info('Not using a test client so this test is skipped to avoid spending too much');
        this.skip();
      }
      logger.debug('Send failing deposit');
      let error;
      try {
        await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
        expect.fail('A deposit that does not pass the X509 check should fail but it did not');
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    });
    it('deposits to a x509-validated account should work', async function () {
      logger.debug('Validating end-user cert');
      await nf3Users[0].validateCertificate(
        endUserCert,
        signEthereumAddress(derPrivateKey, nf3Users[0].ethereumAddress),
        true,
        false,
        0,
        nf3Users[0].ethereumAddress,
      );
      const res = await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });
      logger.debug('Working deposit done');
    });
  });

  describe('Withdrawals from a x509-validated account should work', () => {
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

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      logger.debug('Getting withdrawal hash');
      withdrawal = await nf3Users[0].getLatestWithdrawHash();
      // timejump is the client supports it (basically Ganache)
      await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days
    });

    it('Should do the x509 validation and succeed', async function () {
      if (!nodeInfo.includes('TestRPC')) this.skip();
      const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
      expectTransaction(res);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await web3Client.closeWeb3();
  });
});
