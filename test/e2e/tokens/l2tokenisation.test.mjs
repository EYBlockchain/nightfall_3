/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import gen from 'general-number';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { /* expectTransaction, */ emptyL2, Web3Client } from '../../utils.mjs';
import poseidonHash from '../../../common-files/utils/crypto/poseidon/poseidon.mjs';
import constants from '../../../common-files/constants/index.mjs';

// so we can use require with mjs file
// const { expect } = chai;
const { generalise } = gen;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const { BN128_GROUP_ORDER, SHIFT } = constants;

const {
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;
const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

// why do we need an ERC20 token in an ERC721 test, you ask?
// let me tell you I also don't know, but I guess we just want to fill some blocks?
let erc20Address;
let l2Address;
let stateAddress;
const eventLogs = [];
let rollbackCount = 0;

/*
  This function tries to zero the number of unprocessed transactions in the optimist node
  that nf3 is connected to. We call it extensively on the tests, as we want to query stuff from the
  L2 layer, which is dependent on a block being made. We also need 0 unprocessed transactions by the end
  of the tests, otherwise the optimist will become out of sync with the L2 block count on-chain.
*/

describe('L2 Tokenisation tests', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer('http://optimist', await nf3Proposer1.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });
    await nf3Proposer1.startMakeBlock();

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);

    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
    let randomAddress = 0;
    while (randomAddress === 0) {
      try {
        randomAddress = await randValueLT(SHIFT);
      } catch {
        // Try to get a random value again
      }
    }

    l2Address = generalise(
      randomAddress.bigInt +
        21711016731996786641919559689128982722488122124807605757398297001483711807488n,
    ).hex(32);

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await nf3Users[0].deposit(erc20Address, tokenType, 3 * transferValue, tokenId, 0);

    await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });
  });

  describe('Tokenise tests', () => {
    it('should create a l2 tokenisation successfully', async function () {
      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const value = 1;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(value);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });
  });

  describe('Burn tests', () => {
    it('should partially burn a l2 commitment successfully', async function () {
      const value = 5;
      const valueBurnt = 4;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);

      const [top4Bytes, remainder] = generalise(privateTokenId)
        .limbs(224, 2)
        .map(l => BigInt(l));
      const packedErcAddress = generalise(l2Address).bigInt + top4Bytes * SHIFT;
      const commitmentHash = poseidonHash(
        generalise([
          packedErcAddress,
          remainder,
          generalise(value).field(BN128_GROUP_ORDER),
          ...generalise(nf3Users[0].zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, 1, [commitmentHash]);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(-valueBurnt);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });

    it('should fully burn a l2 commitment successfully', async function () {
      const value = 5;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);

      const [top4Bytes, remainder] = generalise(privateTokenId)
        .limbs(224, 2)
        .map(l => BigInt(l));
      const packedErcAddress = generalise(l2Address).bigInt + top4Bytes * SHIFT;
      const commitmentHash = poseidonHash(
        generalise([
          packedErcAddress,
          remainder,
          generalise(value).field(BN128_GROUP_ORDER),
          ...generalise(nf3Users[0].zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, value, privateTokenId, 1, [commitmentHash]);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(-value);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });

    it('should burn a l2 commitment without specifying the commitment hash successfully', async function () {
      const value = 5;
      const valueBurnt = 4;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);

      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, 1, []);

      await emptyL2({ nf3User: nf3Users[0], web3: web3Client, logs: eventLogs });

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(-valueBurnt);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });
  });

  describe('Commitment Selection tests', () => {
    it('should transfer a specified commitment', async function () {
      const value = 5;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);
      const { compressedZkpPublicKey } = nf3Users[0].zkpKeys;

      const [top4Bytes, remainder] = generalise(privateTokenId)
        .limbs(224, 2)
        .map(l => BigInt(l));
      const packedErcAddress = generalise(l2Address).bigInt + top4Bytes * SHIFT;
      const commitmentHash = poseidonHash(
        generalise([
          packedErcAddress,
          remainder,
          generalise(value).field(BN128_GROUP_ORDER),
          ...generalise(nf3Users[0].zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      // tokenise twice to produce two commitment
      // the commitment we will provide and a commitment that would otherwise be selected
      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      await nf3Users[0].tokenise(l2Address, 1, privateTokenId, 1);

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const beforeCommitments = await nf3Users[0].getLayer2Commitments([l2Address], true);
      const beforeCommitmentValues = beforeCommitments[compressedZkpPublicKey][l2Address].map(
        c => c.balance,
      );
      expect(beforeCommitmentValues).to.include.members([1, 5]);

      await nf3Users[0].transfer(
        true,
        l2Address,
        tokenType,
        1,
        privateTokenId,
        nf3Users[1].zkpKeys.compressedZkpPublicKey,
        1,
        [commitmentHash],
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const afterCommitments = await nf3Users[0].getLayer2Commitments([l2Address], true);
      const afterCommitmentValues = afterCommitments[compressedZkpPublicKey][l2Address].map(
        c => c.balance,
      );
      expect(afterCommitmentValues).to.include.members([1, 4]);

      const beforeCount = beforeCommitments[compressedZkpPublicKey][l2Address].filter(
        c => c.balance === 5,
      ).length;
      const beforeChangeCount = beforeCommitments[compressedZkpPublicKey][l2Address].filter(
        c => c.balance === 4,
      ).length;

      const afterCount = afterCommitments[compressedZkpPublicKey][l2Address].filter(
        c => c.balance === 5,
      ).length;
      const afterChangeCount = afterCommitments[compressedZkpPublicKey][l2Address].filter(
        c => c.balance === 4,
      ).length;

      expect(beforeCount - afterCount).to.equal(1);
      expect(afterChangeCount - beforeChangeCount).to.equal(1);
    });

    it('should transfer a specified commitment for the fee token', async function () {
      // this commitment would be selected if we don't provide a commitment
      await nf3Users[0].deposit(erc20Address, tokenType, 1, tokenId, 0);

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const { compressedZkpPublicKey } = nf3Users[0].zkpKeys;
      const beforeCommitments = await nf3Users[0].getLayer2Commitments([erc20Address], true);
      const largestCommitmentValue = Math.max(
        ...beforeCommitments[compressedZkpPublicKey][erc20Address].map(c => c.balance),
      );

      logger.debug({ beforeCommitments });
      logger.debug({ largestCommitmentValue });

      // since we don't have the salt we need to get the hash from the DB
      const connection = await mongo.connection(MONGO_URL);
      const db = connection.db(COMMITMENTS_DB);
      const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne({
        compressedZkpPublicKey: nf3Users[0].zkpKeys.compressedZkpPublicKey,
        isNullified: false,
        isPendingNullification: false,
        'preimage.ercAddress': generalise(erc20Address).hex(32),
        'preimage.tokenId': generalise(tokenId).hex(32),
        'preimage.value': generalise(largestCommitmentValue).hex(32),
      });
      const commitmentHash = commitment._id;

      await nf3Users[0].transfer(
        true,
        erc20Address,
        tokenType,
        1,
        tokenId,
        nf3Users[1].zkpKeys.compressedZkpPublicKey,
        1,
        [commitmentHash],
      );

      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const afterCommitments = await nf3Users[0].getLayer2Commitments([erc20Address], true);

      // check number of commitments here
      const beforeCount = beforeCommitments[compressedZkpPublicKey][erc20Address].filter(
        c => c.balance === largestCommitmentValue,
      ).length;
      const beforeChangeCount = beforeCommitments[compressedZkpPublicKey][erc20Address].filter(
        c => c.balance === largestCommitmentValue - 2,
      ).length;

      const afterCount = afterCommitments[compressedZkpPublicKey][erc20Address].filter(
        c => c.balance === largestCommitmentValue,
      ).length;
      const afterChangeCount = afterCommitments[compressedZkpPublicKey][erc20Address].filter(
        c => c.balance === largestCommitmentValue - 2,
      ).length;

      expect(beforeCount - afterCount).to.equal(1);
      expect(afterChangeCount - beforeChangeCount).to.equal(1);
    });
  });

  describe('Transform tests', () => {
    it('should burn the input commitment and create commitments for output tokens', async function () {
      const fee = 1;
      const value = 5;
      const salt = (await randValueLT(BN128_GROUP_ORDER)).hex();

      const inputTokens = [
        {
          id: 1,
          address: l2Address,
          value,
          salt,
        },
      ];

      const outputTokens = [
        {
          id: 3,
          address: l2Address,
          value,
          salt,
        },
        {
          id: 4,
          address: l2Address,
          value,
          salt,
        },
      ];

      for (const token of inputTokens) {
        const [top4Bytes, remainder] = generalise(token.id)
          .limbs(224, 2)
          .map(l => BigInt(l));
        const packedErcAddress = generalise(l2Address).bigInt + top4Bytes * SHIFT;
        const commitmentHash = poseidonHash(
          generalise([
            packedErcAddress,
            remainder,
            generalise(token.value).field(BN128_GROUP_ORDER),
            ...generalise(nf3Users[0].zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
            generalise(token.salt).field(BN128_GROUP_ORDER),
          ]),
        ).hex(32);
        token.commitmentHash = commitmentHash;
        await nf3Users[0].tokenise(token.address, token.value, token.id, token.salt, fee);
        await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      }

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      await nf3Users[0].transform(inputTokens, outputTokens, fee);
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      const afterBalance = await nf3Users[0].getLayer2Balances();
      logger.debug({ beforeBalance, afterBalance });

      for (const token of inputTokens) {
        const tokenBalanceAfter = (
          afterBalance[l2Address]?.find(e => e.tokenId === generalise(token.id).hex(32)) || {
            balance: 0,
          }
        ).balance;
        expect(tokenBalanceAfter).to.equal(0);
      }

      for (const token of outputTokens) {
        const tokenBalanceAfter = (
          afterBalance[l2Address]?.find(e => e.tokenId === generalise(token.id).hex(32)) || {
            balance: 0,
          }
        ).balance;
        expect(tokenBalanceAfter).to.equal(value);
      }

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });
  });

  describe('Rollback checks', () => {
    it('test should encounter zero rollbacks', function () {
      expect(rollbackCount).to.be.equal(0);
    });
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
