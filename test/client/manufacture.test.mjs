import chai from 'chai';
import ethers from 'ethers';
import axios from 'axios';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import gen from 'general-number';

import Nf3 from '../../cli/lib/nf3.mjs';
import { getERCInfo } from '../../cli/lib/tokens.mjs';
import { pendingCommitmentCount, Web3Client } from '../utils.mjs';

const { expect } = chai;
const { generalise } = gen;

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { fee, transferValue, MINIMUM_STAKE, mnemonics, signingKeys } = config.TEST_OPTIONS;

const nf3Sender = new Nf3(signingKeys.user1, environment);
const nf3Receiver = new Nf3(signingKeys.user2, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
const web3Client = new Web3Client();

async function emptyL2(user) {
  let count = await pendingCommitmentCount(user);
  /* eslint-disable no-await-in-loop */
  while (count !== 0) {
    await nf3Sender.makeBlockNow();
    try {
      await web3Client.waitForEvent([], ['blockProposed']);
      count = await pendingCommitmentCount(user);
    } catch (err) {
      break;
    }
  }
}

// tokenId is optional
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

// prepare a commitment, deposit it first if needed
async function prepareCommitment(tokenAddress, tokenType, minValue, user, tokenId) {
  let commitments = await getCommitments(tokenAddress, minValue, user, tokenId);
  logger.debug({
    msg: 'possible commitment values',
    commitmentValues: commitments.map(c => parseInt(c.preimage.value, 16)),
  });

  if (commitments.length > 0) return commitments.pop();

  await user.deposit(tokenAddress, tokenType, minValue, ethers.utils.hexZeroPad(tokenId, 32), fee);
  await emptyL2(user);

  commitments = await getCommitments(tokenAddress, minValue, user, tokenId);

  if (commitments.length < 1) throw new Error('could not prepare commitment');
  return commitments.pop();
}

async function getL2tokenBalance(nf3User, tokenAddress) {
  const balances = await nf3User.getLayer2Balances();
  if (!balances[tokenAddress]) return 0;

  return balances[tokenAddress][0].balance;
}

describe('Custom Commitment Selection Test', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer(environment.optimistApiUrl, MINIMUM_STAKE);
    await nf3Proposer.startProposer();

    await nf3Sender.init(mnemonics.user1);
    await nf3Receiver.init(mnemonics.user2);

    const stateAddress = await nf3Sender.stateContractAddress;
    web3Client.subscribeTo('logs', [], { address: stateAddress });
  });

  describe('Manufacture', () => {
    it('should manufacture a new token from an input token', async () => {
      const res = await axios.post(`${environment.clientApiUrl}/manufacture`, {
        rootKey: nf3Sender.zkpKeys.rootKey,
        tokenInputs: [],
        tokenOutputs: [],
        fee,
        compressedZkpPublicKey: nf3Receiver.zkpKeys.compressedZkpPublicKey,
      });
    });

    after(() => {
      nf3Sender.close();
      nf3Receiver.close();
      web3Client.closeWeb3();
    });
  });
});
