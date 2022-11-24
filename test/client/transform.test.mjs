/* eslint-disable no-await-in-loop */

import chai from 'chai';
import axios from 'axios';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import gen from 'general-number';

import Nf3 from '../../cli/lib/nf3.mjs';
import { pendingCommitmentCount, Web3Client } from '../utils.mjs';

// const { expect } = chai;
const { generalise } = gen;
const { BN128_GROUP_ORDER } = constants;
const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { fee, mnemonics, signingKeys } = config.TEST_OPTIONS;

const nf3Sender = new Nf3(signingKeys.user1, environment);
const nf3Receiver = new Nf3(signingKeys.user2, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
const web3Client = new Web3Client();

async function getCommitments(tokenAddress, minValue, user, tokenId) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      compressedZkpPublicKey: user.zkpKeys.compressedZkpPublicKey,
      isNullified: false,
      isPendingNullification: false,
      'preimage.ercAddress': generalise(tokenAddress).hex(32),
      'preimage.tokenId': generalise(tokenId).hex(32),
    })
    .toArray();

  return commitments
    .filter(c => Number(c.isOnChain) > -1)
    .filter(c => c.preimage.value >= minValue);
}

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

// async function getL2tokenBalance(nf3User, tokenAddress, tokenId = 0) {
//   const balances = await nf3User.getLayer2Balances();
//   const hexTokenAddress = generalise(tokenAddress).hex();
//   const hexTokenId = generalise(tokenId).hex(32);
//   return balances[hexTokenAddress]?.find(e => e.tokenId === hexTokenId)?.balance || 0;
// }

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
      const L2TokenAddress = '0x300000000000000000000000093a18411e007b581a6969785dba66ef69b5bd5f';
      const inputTokens = [
        {
          id: 1,
          address: L2TokenAddress,
          value: 1,
          salt: await randValueLT(BN128_GROUP_ORDER),
        },
        // {
        //   id: 2,
        //   address: L2TokenAddress,
        //   value: 1,
        //   salt: await randValueLT(BN128_GROUP_ORDER),
        // },
      ];

      const outputTokens = [
        {
          id: 3,
          address: L2TokenAddress,
          value: 1,
          salt: (await randValueLT(BN128_GROUP_ORDER)).hex(),
        },
        {
          id: 4,
          address: L2TokenAddress,
          value: 1,
          salt: (await randValueLT(BN128_GROUP_ORDER)).hex(),
        },
      ];

      logger.debug({ balances: await nf3Sender.getLayer2Balances() });

      for (let i = 0; i <= inputTokens.length; i++) {
        logger.debug('depositing...');
        await nf3Sender.deposit(feeTokenAddress, 'ERC20', 10, 0, 0);
      }
      await emptyL2(nf3Sender);

      logger.debug({ balances: await nf3Sender.getLayer2Balances() });

      for (const token of inputTokens) {
        logger.debug('tokenising...');
        await nf3Sender.tokenise(token.address, token.value, token.id, token.salt.hex(), 1);
      }
      await emptyL2(nf3Sender);

      for (const token of inputTokens) {
        const commitment = (
          await getCommitments(token.address, token.value, nf3Sender, token.id)
        ).pop();

        token.commitmentHash = commitment._id;
        token.commitmentValue = commitment.value;
      }

      await axios.post(`${environment.clientApiUrl}/transform`, {
        rootKey: nf3Sender.zkpKeys.rootKey,
        inputTokens: inputTokens.map(({ id, address, value, commitmentHash }) => ({
          id,
          address,
          value,
          commitmentHash,
        })),
        outputTokens,
        fee,
        compressedZkpPublicKey: nf3Receiver.zkpKeys.compressedZkpPublicKey,
      });

      await emptyL2(nf3Sender);

      logger.debug({ balances: await nf3Sender.getLayer2Balances() });
    });
  });
});
