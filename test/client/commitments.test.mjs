/* eslint-disable no-await-in-loop */
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

const { generalise } = gen;
// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  txPerBlock,
  MINIMUM_STAKE,
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
const web3Client = new Web3Client();

let ercAddress;
let stateAddress;
const eventLogs = [];

async function commitmentsToSend(userKey) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      compressedZkpPublicKey: userKey,
      isNullified: false,
      isPendingNullification: false,
      'preimage.ercAddress': ethers.utils.hexZeroPad(ercAddress, 32),
      'preimage.tokenId': ethers.utils.hexZeroPad(tokenId, 32),
    })
    .toArray();
  return commitments;
}

async function getL2tokenBalance(nf3User) {
  const balances = await nf3User.getLayer2Balances();
  logger.debug(balances);
  if (!balances[ercAddress]) return 0;
  return balances[ercAddress][0].balance;
}

async function emptyL2() {
  await new Promise(resolve => setTimeout(resolve, 6000));
  let count = await pendingCommitmentCount(nf3Users[0]);
  while (count !== 0) {
    await nf3Users[0].makeBlockNow();
    try {
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      count = await pendingCommitmentCount(nf3Users[0]);
    } catch (err) {
      break;
    }
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
}

describe('Custom Commitment Selection Test', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    logger.debug(environment.optimistApiUrl);
    await nf3Proposer.registerProposer(environment.optimistApiUrl, MINIMUM_STAKE);
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);

    ercAddress = await nf3Users[0].getContractAddress('ERC20Mock');
    stateAddress = await nf3Users[0].stateContractAddress;

    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
    const senderKey = nf3Users[0].zkpKeys.compressedZkpPublicKey;
    const commitments = await commitmentsToSend(senderKey);

    // TODO:
    // figure out what commitment would be picked natively
    // specify a different one in the call to client
    // make sure we used the correct commitment
    if (commitments.filter(c => parseInt(c.preimage.value, 16) >= transferValue + fee).length < 3) {
      logger.debug('funding sender account');
      const deposits = Array.from({ length: 4 }, () =>
        nf3Users[0].deposit(ercAddress, tokenType, transferValue + fee, tokenId, fee),
      );
      await Promise.all(deposits);
      await emptyL2();
    }
  });

  describe('Transfers', () => {
    it('should transfer a specified commitment', async () => {
      const senderKey = nf3Users[0].zkpKeys.compressedZkpPublicKey;
      const recipientKey = nf3Users[1].zkpKeys.compressedZkpPublicKey;
      const commitments = await commitmentsToSend(senderKey).then(rawCommitments =>
        rawCommitments
          .filter(c => c.preimage.value >= transferValue + fee)
          .sort((a, b) => b.preimage.value - a.preimage.value),
      );

      logger.debug({
        msg: 'possible commitments:',
        values: commitments.map(c => Number(c.preimage.value)).toString(),
      });

      const selectedCommitment = commitments[0];

      const senderBalance = await getL2tokenBalance(nf3Users[0]);
      const recipientBalance = await getL2tokenBalance(nf3Users[1]);

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress,
        tokenId,
        recipientData: {
          values: [transferValue],
          recipientCompressedZkpPublicKeys: [recipientKey],
        },
        rootKey: nf3Users[0].zkpKeys.rootKey,
        fee,
        providedCommitments: [selectedCommitment._id],
      });

      // since the transaction is on chain we still need to submit it
      await nf3Users[0].submitTransaction(
        res.data.txDataToSign,
        nf3Users[0].shieldContractAddress,
        0,
      );

      // assert commitment is spent
      await emptyL2();
      const remainingCommitments = await commitmentsToSend(senderKey);
      expect(remainingCommitments).to.not.include(selectedCommitment);
      expect(await getL2tokenBalance(nf3Users[0])).to.equal(senderBalance - transferValue - fee);
      expect(await getL2tokenBalance(nf3Users[1])).to.equal(recipientBalance + transferValue);
    });

    it('should transfer a specified ERC721 commitment', async () => {
      const senderKey = nf3Users[0].zkpKeys.compressedZkpPublicKey;
      const recipientKey = nf3Users[1].zkpKeys.compressedZkpPublicKey;

      const erc721Address = await nf3Users[0].getContractAddress('ERC721Mock');
      logger.debug(erc721Address);

      const availableTokenIds = (
        await getERCInfo(erc721Address, nf3Users[0].ethereumAddress, web3Client.getWeb3(), {
          details: true,
        })
      ).details.map(t => t.tokenId);
      const erc721TokenId = generalise(availableTokenIds.shift()).hex(32);
      logger.debug(`erc721 token id ${erc721TokenId}`);

      await nf3Users[0].deposit(erc721Address, 'ERC721', 0, erc721TokenId);
      await emptyL2();

      const connection = await mongo.connection(MONGO_URL);
      const selectedCommitment = await connection
        .db(COMMITMENTS_DB)
        .collection(COMMITMENTS_COLLECTION)
        .findOne({
          compressedZkpPublicKey: senderKey,
          isNullified: false,
          isPendingNullification: false,
          'preimage.ercAddress': ethers.utils.hexZeroPad(erc721Address, 32),
          'preimage.tokenId': erc721TokenId,
        });

      expect(selectedCommitment).to.not.equal(null);
      logger.debug(`selected commit with ID: ${selectedCommitment._id}`);

      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress: erc721Address,
        tokenId: erc721TokenId,
        recipientData: {
          values: [0],
          recipientCompressedZkpPublicKeys: [recipientKey],
        },
        rootKey: nf3Users[0].zkpKeys.rootKey,
        fee,
        providedCommitments: [selectedCommitment._id],
      });

      // since the transaction is on chain we still need to submit it
      await nf3Users[0].submitTransaction(
        res.data.txDataToSign,
        nf3Users[0].shieldContractAddress,
        0,
      );

      // assert commitment is spent
      await emptyL2();
      const remainingCommitments = await commitmentsToSend(senderKey);
      expect(remainingCommitments).to.not.include(selectedCommitment);
    });

    it('should reject invalid hashes', async () => {
      const recipientKey = nf3Users[1].zkpKeys.compressedZkpPublicKey;
      const invalidHash = 'invalid hash';
      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress,
        tokenId,
        recipientData: {
          values: [transferValue],
          recipientCompressedZkpPublicKeys: [recipientKey],
        },
        rootKey: nf3Users[0].zkpKeys.rootKey,
        fee,
        providedCommitments: [invalidHash],
      });

      expect(res.data.error).to.include(invalidHash);
    });

    it('reject and return only the invalid hash to the user', async () => {
      const senderKey = nf3Users[0].zkpKeys.compressedZkpPublicKey;
      const recipientKey = nf3Users[1].zkpKeys.compressedZkpPublicKey;
      const invalidHash = 'invalid hash';
      const commitments = await commitmentsToSend(senderKey).then(rawCommitments =>
        rawCommitments
          .filter(c => c.preimage.value >= transferValue + fee)
          .sort((a, b) => b.preimage.value - a.preimage.value),
      );
      const res = await axios.post(`${environment.clientApiUrl}/transfer`, {
        offchain: false,
        ercAddress,
        tokenId,
        recipientData: {
          values: [transferValue],
          recipientCompressedZkpPublicKeys: [recipientKey],
        },
        rootKey: nf3Users[0].zkpKeys.rootKey,
        fee,
        providedCommitments: [commitments[0]._id, invalidHash],
      });

      expect(res.data.error).to.include(invalidHash);
      expect(res.data.error).to.not.include(commitments[0]._id);
    });
  });

  describe('Withdrawals', () => {
    it('should withdraw the specified commitment', async () => {
      const senderKey = nf3Users[0].zkpKeys.compressedZkpPublicKey;
      const commitments = await commitmentsToSend(senderKey).then(rawCommitments =>
        rawCommitments
          .filter(c => c.preimage.value >= transferValue + fee)
          .sort((a, b) => b.preimage.value - a.preimage.value),
      );

      logger.debug({
        msg: 'possible commitments:',
        values: commitments.map(c => Number(c.preimage.value)).toString(),
      });

      const selectedCommitment = commitments[0];
      const senderBalance = await getL2tokenBalance(nf3Users[0]);

      const res = await axios
        .post(`${environment.clientApiUrl}/withdraw`, {
          offchain: false,
          ercAddress,
          tokenId,
          tokenType,
          value: transferValue,
          recipientAddress: nf3Users[0].ethereumAddress,
          rootKey: nf3Users[0].zkpKeys.rootKey,
          fee,
          providedCommitments: [selectedCommitment._id],
        })
        .catch(console.log);
      logger.debug(res);

      // since the transaction is on chain we still need to submit it
      await nf3Users[0].submitTransaction(
        res.data.txDataToSign,
        nf3Users[0].shieldContractAddress,
        0,
      );

      // assert commitment is spent
      await emptyL2();
      const remainingCommitments = await commitmentsToSend(senderKey);
      expect(remainingCommitments).to.not.include(selectedCommitment);
      expect(await getL2tokenBalance(nf3Users[0])).to.equal(senderBalance - transferValue - fee);
    });
  });

  after(async () => {
    nf3Users[0].close();
    nf3Users[1].close();
    web3Client.closeWeb3();
  });
});
