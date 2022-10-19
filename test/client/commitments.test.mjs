import chai from 'chai';
import ethers from 'ethers';
import axios from 'axios';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import gen from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';

import Nf3 from '../../cli/lib/nf3.mjs';
import { getERCInfo } from '../../cli/lib/tokens.mjs';
import { pendingCommitmentCount, Web3Client } from '../utils.mjs';
import { setTimeout } from 'timers/promises';
import { boolean } from 'fast-check';

const { generalise } = gen;
const { expect } = chai;

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
      'preimage.ercAddress': ethers.utils.hexZeroPad(tokenAddress, 32),
      'preimage.tokenId': ethers.utils.hexZeroPad(tokenId, 32),
    })
    .toArray();

  return commitments
    .filter(c => tokenId === '0x00' || c.preimage.tokenId === tokenId)
    .filter(c => c.preimage.value >= minValue);
}

// prepare a commitment, deposit it first if needed
async function prepareCommitment(tokenAddress, tokenType, minValue, user, tokenId) {
  let commitments = await getCommitments(tokenAddress, minValue, user, tokenId);
  if (commitments.length > 0) return commitments.pop();

  await user.deposit(tokenAddress, tokenType, minValue, tokenId, fee);
  await emptyL2(user);

  let maxTries = 20;
  while (commitments.length < 1 && maxTries > 0) {
    await setTimeout(2000);
    commitments = await getCommitments(tokenAddress, minValue, user, tokenId);
    maxTries--;
  }

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

  describe('Transfers', () => {
    it('should transfer a specified commitment', async () => {
      const receiverKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;
      const tokenAddress = await nf3Sender.getContractAddress('ERC20Mock');

      const commitment = await prepareCommitment(
        tokenAddress,
        'ERC20',
        transferValue + fee,
        nf3Sender,
        '0x00',
      );

      const senderBalance = await getL2tokenBalance(nf3Sender, tokenAddress);
      const recipientBalance = await getL2tokenBalance(nf3Receiver, tokenAddress);

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress: tokenAddress,
        tokenId: '0x00',
        recipientData: {
          values: [transferValue],
          recipientCompressedZkpPublicKeys: [receiverKey],
        },
        rootKey: nf3Sender.zkpKeys.rootKey,
        fee,
        providedCommitments: [commitment._id],
      });

      // since the transaction is on chain we still need to submit it
      await nf3Sender.submitTransaction(res.data.txDataToSign, nf3Sender.shieldContractAddress, 0);

      // assert commitment is spent
      await emptyL2();
      const remainingCommitments = await getCommitments(
        tokenAddress,
        transferValue + fee,
        nf3Sender,
      );
      expect(remainingCommitments).to.not.include(commitment);
      expect(await getL2tokenBalance(nf3Sender)).to.equal(senderBalance - transferValue - fee);
      expect(await getL2tokenBalance(nf3Receiver)).to.equal(recipientBalance + transferValue);
    });

//    it('should transfer a specified ERC721 commitment', async () => {
//      const senderKey = nf3Sender.zkpKeys.compressedZkpPublicKey;
//      const recipientKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;
//
//      const tokenAddress = await nf3Sender.getContractAddress('ERC721Mock');
//      const availableTokenIds = (
//        await getERCInfo(tokenAddress, nf3Sender.ethereumAddress, web3Client.getWeb3(), {
//          details: true,
//        })
//      ).details.map(t => t.tokenId);
//      const tokenId = generalise(availableTokenIds.shift()).hex(32);
//
//      const commitment = await prepareCommitment(tokenAddress, 'ERC721', 1, nf3Sender, tokenId);
//
//      const commitmentFee = await prepareCommitment(tokenAddress, 'ERC20', fee, nf3Sender, '0x00');
//
//      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
//        offchain: false,
//        ercAddress: tokenAddress,
//        tokenId,
//        recipientData: {
//          values: [0],
//          recipientCompressedZkpPublicKeys: [recipientKey],
//        },
//        rootKey: nf3Sender.zkpKeys.rootKey,
//        fee,
//        providedCommitments: [commitment._id],
//      });
//
//      // since the transaction is on chain we still need to submit it
//      await nf3Sender.submitTransaction(res.data.txDataToSign, nf3Sender.shieldContractAddress, 0);
//
//      // assert commitment is spent
//      await emptyL2();
//    });
//
//    it('should reject invalid hashes', async () => {
//      const recipientKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;
//      const invalidHash = 'invalid hash';
//      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
//        offchain: false,
//        ercAddress,
//        tokenId,
//        recipientData: {
//          values: [transferValue],
//          recipientCompressedZkpPublicKeys: [recipientKey],
//        },
//        rootKey: nf3Sender.zkpKeys.rootKey,
//        fee,
//        providedCommitments: [invalidHash],
//      });
//
//      expect(res.data.error).to.include(invalidHash);
//    });
//
//    it('reject and return only the invalid hash to the user', async () => {
//      const senderKey = nf3Sender.zkpKeys.compressedZkpPublicKey;
//      const recipientKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;
//      const invalidHash = 'invalid hash';
//      const commitments = await commitmentsToSend(senderKey).then(rawCommitments =>
//        rawCommitments
//          .filter(c => c.preimage.value >= transferValue + fee)
//          .sort((a, b) => b.preimage.value - a.preimage.value),
//      );
//      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
//        offchain: false,
//        ercAddress,
//        tokenId,
//        recipientData: {
//          values: [transferValue],
//          recipientCompressedZkpPublicKeys: [recipientKey],
//        },
//        rootKey: nf3Receiver.zkpKeys.rootKey,
//        fee,
//        providedCommitments: [commitments[0]._id, invalidHash],
//      });
//
//      expect(res.data.error).to.include(invalidHash);
//      expect(res.data.error).to.not.include(commitments[0]._id);
//    });
//  });
//
//  describe('Withdrawals', () => {
//    it('should withdraw the specified commitment', async () => {
//      const senderKey = nf3Sender.zkpKeys.compressedZkpPublicKey;
//      const commitments = await commitmentsToSend(senderKey).then(rawCommitments =>
//        rawCommitments
//          .filter(c => c.preimage.value >= transferValue + fee)
//          .sort((a, b) => b.preimage.value - a.preimage.value),
//      );
//
//      logger.debug({
//        msg: 'possible commitments:',
//        values: commitments.map(c => Number(c.preimage.value)).toString(),
//      });
//
//      const selectedCommitment = commitments[0];
//      const senderBalance = await getL2tokenBalance(nf3Sender);
//
//      const res = await axios
//        .post(`${environment.clientApiUrl}/withdraw`, {
//          offchain: false,
//          ercAddress,
//          tokenId,
//          tokenType,
//          value: transferValue,
//          recipientAddress: nf3Sender.ethereumAddress,
//          rootKey: nf3Sender.zkpKeys.rootKey,
//          fee,
//          providedCommitments: [selectedCommitment._id],
//        })
//        .catch(console.log);
//      logger.debug(res);
//
//      // since the transaction is on chain we still need to submit it
//      await nf3Sender.submitTransaction(res.data.txDataToSign, nf3Sender.shieldContractAddress, 0);
//
//      // assert commitment is spent
//      await emptyL2();
//      const remainingCommitments = await commitmentsToSend(senderKey);
//      expect(remainingCommitments).to.not.include(selectedCommitment);
//      expect(await getL2tokenBalance(nf3Sender)).to.equal(senderBalance - transferValue - fee);
//    });
  });

  after(() => {
    nf3Sender.close();
    nf3Receiver.close();
    web3Client.closeWeb3();
  });
});
