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

      const startBalances = {
        msg: 'start balances',
        senderBalance: await getL2tokenBalance(nf3Sender, tokenAddress),
        recipientBalance: await getL2tokenBalance(nf3Receiver, tokenAddress),
      };
      logger.debug({
        ...startBalances,
        transferValue,
        fee,
        commitmentValue: parseInt(commitment.preimage.value, 16),
      });

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress: ethers.utils.hexZeroPad(tokenAddress, 32),
        tokenId: ethers.utils.hexZeroPad('0x00', 32),
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
      await emptyL2(nf3Sender);
      const remainingCommitments = await getCommitments(
        tokenAddress,
        transferValue + fee,
        nf3Sender,
        '0x00',
      );
      logger.debug(remainingCommitments.map(c => parseInt(c.preimage.value, 16)));
      expect(remainingCommitments).to.not.include(commitment);

      await emptyL2(nf3Receiver);
      const endBalances = {
        msg: 'end balances',
        senderBalance: await getL2tokenBalance(nf3Sender, tokenAddress),
        recipientBalance: await getL2tokenBalance(nf3Receiver, tokenAddress),
      };
      logger.debug(endBalances);

      expect(endBalances.senderBalance).to.equal(startBalances.senderBalance - transferValue - fee);
      expect(endBalances.recipientBalance).to.equal(startBalances.recipientBalance + transferValue);
    });

    it('should look for missing fee when transferring fee token', async () => {
      const receiverKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;
      const tokenAddress = await nf3Sender.getContractAddress('ERC20Mock');

      // not enough to pay the fee
      const commitment = await prepareCommitment(
        tokenAddress,
        'ERC20',
        transferValue,
        nf3Sender,
        '0x00',
      );

      // a different commitment that covers the fee
      await nf3Sender.deposit(tokenAddress, 'ERC20', fee, ethers.utils.hexZeroPad('0x00', 32), fee);

      await emptyL2(nf3Sender);

      const startBalances = {
        msg: 'start balances',
        senderBalance: await getL2tokenBalance(nf3Sender, tokenAddress),
        recipientBalance: await getL2tokenBalance(nf3Receiver, tokenAddress),
      };
      logger.debug({
        ...startBalances,
        transferValue,
        fee,
        commitmentValue: parseInt(commitment.preimage.value, 16),
      });

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress: ethers.utils.hexZeroPad(tokenAddress, 32),
        tokenId: ethers.utils.hexZeroPad('0x00', 32),
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
      await emptyL2(nf3Sender);
      const remainingCommitments = await getCommitments(tokenAddress, 0, nf3Sender, '0x00');
      logger.debug(remainingCommitments.map(c => parseInt(c.preimage.value, 16)));
      expect(remainingCommitments).to.not.include(commitment);

      await emptyL2(nf3Receiver);
      const endBalances = {
        msg: 'end balances',
        senderBalance: await getL2tokenBalance(nf3Sender, tokenAddress),
        recipientBalance: await getL2tokenBalance(nf3Receiver, tokenAddress),
      };
      logger.debug(endBalances);

      expect(endBalances.senderBalance).to.equal(startBalances.senderBalance - transferValue - fee);
      expect(endBalances.recipientBalance).to.equal(startBalances.recipientBalance + transferValue);
    });
    it('should transfer a specified ERC721 commitment', async () => {
      const recipientKey = nf3Receiver.zkpKeys.compressedZkpPublicKey;

      const tokenAddress = await nf3Sender.getContractAddress('ERC721Mock');
      const feeTokenAddress = await nf3Sender.getContractAddress('ERC20Mock');
      const availableTokenIds = (
        await getERCInfo(tokenAddress, nf3Sender.ethereumAddress, web3Client.getWeb3(), {
          details: true,
        })
      ).details.map(t => t.tokenId);
      const tokenId = generalise(availableTokenIds.shift()).hex(32);

      const commitment = await prepareCommitment(tokenAddress, 'ERC721', 0, nf3Sender, tokenId);
      await prepareCommitment(feeTokenAddress, 'ERC20', fee, nf3Sender, '0x00');

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress: tokenAddress,
        tokenId,
        recipientData: {
          values: [0],
          recipientCompressedZkpPublicKeys: [recipientKey],
        },
        rootKey: nf3Sender.zkpKeys.rootKey,
        fee,
        providedCommitments: [commitment._id],
      });

      // since the transaction is on chain we still need to submit it
      await nf3Sender.submitTransaction(res.data.txDataToSign, nf3Sender.shieldContractAddress, 0);

      // assert commitment is spent
      await emptyL2(nf3Sender);
      const remainingCommitments = await getCommitments(tokenAddress, 0, nf3Sender, tokenId);
      expect(remainingCommitments).to.not.include(commitment);
    });

    describe('Withdrawals', () => {
      it('should withdraw the specified commitment', async () => {
        const tokenAddress = await nf3Sender.getContractAddress('ERC20Mock');

        const commitment = await prepareCommitment(
          tokenAddress,
          'ERC20',
          transferValue + fee,
          nf3Sender,
          '0x00',
        );

        const startBalance = await getL2tokenBalance(nf3Sender, tokenAddress);
        const res = await axios
          .post(`${environment.clientApiUrl}/withdraw`, {
            offchain: false,
            ercAddress: tokenAddress,
            tokenId: '0x00',
            tokenType: 'ERC20',
            value: transferValue,
            recipientAddress: nf3Sender.ethereumAddress,
            rootKey: nf3Sender.zkpKeys.rootKey,
            fee,
            providedCommitments: [commitment._id],
          })
          .catch(console.log);

        // since the transaction is on chain we still need to submit it
        await nf3Sender.submitTransaction(
          res.data.txDataToSign,
          nf3Sender.shieldContractAddress,
          0,
        );

        // assert commitment is spent
        await emptyL2(nf3Sender);

        const remainingCommitments = await getCommitments(tokenAddress, 0, nf3Sender, '0x00');
        expect(remainingCommitments).to.not.include(commitment);

        const endBalance = await getL2tokenBalance(nf3Sender, tokenAddress);
        expect(endBalance).to.equal(startBalance - transferValue - fee);
      });
    });

    after(() => {
      nf3Sender.close();
      nf3Receiver.close();
      web3Client.closeWeb3();
    });
  });
});
