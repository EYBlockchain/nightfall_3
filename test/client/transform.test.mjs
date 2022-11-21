/* eslint-disable no-await-in-loop */
import chai from 'chai';
import axios from 'axios';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import gen from 'general-number';

import Nf3 from '../../cli/lib/nf3.mjs';
import { pendingCommitmentCount, Web3Client } from '../utils.mjs';

const { expect } = chai;
const { generalise } = gen;
const { BN128_GROUP_ORDER } = constants;

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { fee, mnemonics, signingKeys } = config.TEST_OPTIONS;

const nf3Sender = new Nf3(signingKeys.user1, environment);
const nf3Receiver = new Nf3(signingKeys.user2, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
const web3Client = new Web3Client();

async function emptyL2(user) {
  let count = await pendingCommitmentCount(user);
  while (count !== 0) {
    await user.makeBlockNow();
    try {
      await web3Client.waitForEvent([], ['blockProposed']);
      count = await pendingCommitmentCount(user);
    } catch (err) {
      break;
    }
  }
}

async function getL2tokenBalance(nf3User, tokenAddress, tokenId = 0) {
  const balances = await nf3User.getLayer2Balances();
  const hexTokenAddress = generalise(tokenAddress).hex();
  const hexTokenId = generalise(tokenId).hex(32);

  return balances[hexTokenAddress]?.find(e => e.tokenId === hexTokenId)?.balance || 0;
}

describe('Manufacture Service Tests', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    const minStake = await nf3Proposer.getMinimumStake();
    await nf3Proposer.registerProposer('http://optimist', minStake);
    await nf3Proposer.startProposer();

    await nf3Sender.init(mnemonics.user1);
    await nf3Receiver.init(mnemonics.user2);

    const stateAddress = await nf3Sender.stateContractAddress;
    web3Client.subscribeTo('logs', [], { address: stateAddress });
  });

  after(() => {
    logger.debug('cleaning up...');
    nf3Proposer.deregisterProposer();
    nf3Proposer.close();
    nf3Sender.close();
    nf3Receiver.close();
    web3Client.closeWeb3();
  });

  describe('Manufacture', () => {
    it('should manufacture a new token from an input token', async () => {
      const feeTokenAddress = await nf3Sender.getContractAddress('ERC20Mock');

      const inputTokenIdA = 111;
      const inputTokenIdB = 222;
      const L2TokenAddress = '0x300000000000000000000000093a18411e007b581a6969785dba66ef69b5bd5f';
      const salt = await randValueLT(BN128_GROUP_ORDER);

      let feeBalance = await getL2tokenBalance(nf3Sender, feeTokenAddress, 0);
      let inputBalanceA = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdA);
      let inputBalanceB = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdB);

      logger.debug({ msg: 'fee token balance before deposit', feeBalance });
      logger.debug({ msg: 'input token A balance before deposit', inputBalanceA });
      logger.debug({ msg: 'input token B balance before deposit', inputBalanceB });

      await nf3Sender.deposit(feeTokenAddress, 'ERC20', 10, 0, 0);
      await nf3Sender.deposit(feeTokenAddress, 'ERC20', 10, 0, 0);
      await emptyL2(nf3Sender);
      logger.debug('deposited fee tokens');

      await nf3Sender.tokenise(L2TokenAddress, 10, inputTokenIdA, salt.hex(), 1);
      await nf3Sender.tokenise(L2TokenAddress, 10, inputTokenIdB, salt.hex(), 1);
      await emptyL2(nf3Sender);

      feeBalance = await getL2tokenBalance(nf3Sender, feeTokenAddress, 0);
      inputBalanceA = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdA);
      inputBalanceB = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdB);

      logger.debug({ msg: 'fee token balance before transform', feeBalance });
      logger.debug({ msg: 'input token A balance before tranform', inputBalanceA });
      logger.debug({ msg: 'input token B balance before transform', inputBalanceB });

      const outputTokenId = 333;
      let outputBalance = await getL2tokenBalance(nf3Sender, L2TokenAddress, outputTokenId);
      logger.debug({ msg: 'output token balance before transform', outputBalance });

      await axios.post(`${environment.clientApiUrl}/transform`, {
        rootKey: nf3Sender.zkpKeys.rootKey,
        tokenInputs: [
          {
            ercAddress: L2TokenAddress,
            tokenId: inputTokenIdA,
            value: 1,
          },
          {
            ercAddress: L2TokenAddress,
            tokenId: inputTokenIdB,
            value: 1,
          },
        ],
        tokenOutputs: [
          {
            ercAddress: L2TokenAddress,
            tokenId: outputTokenId,
            value: 1,
          },
        ],
        fee,
        compressedZkpPublicKey: nf3Receiver.zkpKeys.compressedZkpPublicKey,
      });

      await new Promise(resolve => setTimeout(resolve, 6000));
      await emptyL2(nf3Sender);

      const inputBalanceAOld = inputBalanceA;
      const inputBalanceBOld = inputBalanceB;
      const outputBalanceOld = outputBalance;

      feeBalance = await getL2tokenBalance(nf3Sender, feeTokenAddress, 0);
      inputBalanceA = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdA);
      inputBalanceB = await getL2tokenBalance(nf3Sender, L2TokenAddress, inputTokenIdB);
      outputBalance = await getL2tokenBalance(nf3Sender, L2TokenAddress, outputTokenId);

      logger.debug({ msg: 'fee token balance after transform', feeBalance });
      logger.debug({ msg: 'input token A balance after transform', inputBalanceA });
      logger.debug({ msg: 'input token B balance after transform', inputBalanceB });
      logger.debug({ msg: 'output token balance after transform', outputBalance });

      expect(inputBalanceA).to.equal(inputBalanceAOld - 1);
      expect(inputBalanceB).to.equal(inputBalanceBOld - 1);
      expect(outputBalance).to.equal(outputBalanceOld + 1);
    });
  });
});
