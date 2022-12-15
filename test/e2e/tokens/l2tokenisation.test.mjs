/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import gen from 'general-number';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { Web3Client } from '../../utils.mjs';
import poseidonHash from '../../../common-files/utils/crypto/poseidon/poseidon.mjs';
import constants from '../../../common-files/constants/index.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;
const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

const { generalise } = gen;

const { BN128_GROUP_ORDER, SHIFT } = constants;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3User2 = new Nf3(signingKeys.user2, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);
nf3Proposer.setApiKey(environment.AUTH_TOKEN);

async function makeBlock() {
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('L2 Tokenisation tests', () => {
  let erc20Address;
  let l2Address;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

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

    await nf3User.deposit(erc20Address, tokenType, transferValue * 3, tokenId, 0);
    await makeBlock();
  });

  describe('Tokenise tests', () => {
    it('should create a l2 tokenisation successfully', async function () {
      const beforeBalance = await nf3User.getLayer2Balances();

      const value = 1;
      const privateTokenId = 11;
      const salt = await randValueLT(BN128_GROUP_ORDER);

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3User.tokenise(l2Address, value, privateTokenId, salt.hex(), 1);
      await makeBlock();

      const afterBalance = await nf3User.getLayer2Balances();
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
          ...generalise(nf3User.zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      await nf3User.tokenise(l2Address, value, privateTokenId, salt.hex(), 1);
      await makeBlock();

      const beforeBalance = await nf3User.getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3User.burn(l2Address, valueBurnt, privateTokenId, [commitmentHash], 1);
      await makeBlock();

      const afterBalance = await nf3User.getLayer2Balances();
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
          ...generalise(nf3User.zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      await nf3User.tokenise(l2Address, value, privateTokenId, salt.hex(), 1);
      await makeBlock();

      const beforeBalance = await nf3User.getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3User.burn(l2Address, value, privateTokenId, [commitmentHash], 1);
      await makeBlock();

      const afterBalance = await nf3User.getLayer2Balances();
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

      await nf3User.tokenise(l2Address, value, privateTokenId, salt.hex(), 1);
      await makeBlock();

      const beforeBalance = await nf3User.getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3User.burn(l2Address, valueBurnt, privateTokenId, [], 1);
      await makeBlock();

      const afterBalance = await nf3User.getLayer2Balances();
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
      const { compressedZkpPublicKey } = nf3User.zkpKeys;

      const [top4Bytes, remainder] = generalise(privateTokenId)
        .limbs(224, 2)
        .map(l => BigInt(l));
      const packedErcAddress = generalise(l2Address).bigInt + top4Bytes * SHIFT;
      const commitmentHash = poseidonHash(
        generalise([
          packedErcAddress,
          remainder,
          generalise(value).field(BN128_GROUP_ORDER),
          ...generalise(nf3User.zkpKeys.zkpPublicKey).all.field(BN128_GROUP_ORDER),
          salt.field(BN128_GROUP_ORDER),
        ]),
      ).hex(32);

      // tokenise twice to produce two commitment
      // the commitment we will provide and a commitment that would otherwise be selected
      await nf3User.tokenise(l2Address, value, privateTokenId, salt.hex(), 1);
      await makeBlock();

      await nf3User.tokenise(l2Address, 1, privateTokenId, 1);
      await makeBlock();

      const beforeCommitments = await nf3User.getLayer2Commitments([l2Address], true);
      const beforeCommitmentValues = beforeCommitments[compressedZkpPublicKey][l2Address].map(
        c => c.balance,
      );
      expect(beforeCommitmentValues).to.include.members([1, 5]);

      await nf3User.transfer(
        true,
        l2Address,
        tokenType,
        1,
        privateTokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        1,
        [commitmentHash],
      );
      await makeBlock();

      const afterCommitments = await nf3User.getLayer2Commitments([l2Address], true);
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
      await nf3User.deposit(erc20Address, tokenType, 1, tokenId, 0);
      await makeBlock();

      const { compressedZkpPublicKey } = nf3User.zkpKeys;
      const beforeCommitments = await nf3User.getLayer2Commitments([erc20Address], true);
      const largestCommitmentValue = Math.max(
        ...beforeCommitments[compressedZkpPublicKey][erc20Address].map(c => c.balance),
      );

      logger.debug({ beforeCommitments });
      logger.debug({ largestCommitmentValue });

      // since we don't have the salt we need to get the hash from the DB
      const connection = await mongo.connection(MONGO_URL);
      const db = connection.db(COMMITMENTS_DB);
      const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne({
        compressedZkpPublicKey: nf3User.zkpKeys.compressedZkpPublicKey,
        isNullified: false,
        isPendingNullification: false,
        'preimage.ercAddress': generalise(erc20Address).hex(32),
        'preimage.tokenId': generalise(tokenId).hex(32),
        'preimage.value': generalise(largestCommitmentValue).hex(32),
      });
      const commitmentHash = commitment._id;

      await nf3User.transfer(
        true,
        erc20Address,
        tokenType,
        1,
        tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        1,
        [commitmentHash],
      );
      await makeBlock();

      const afterCommitments = await nf3User.getLayer2Commitments([erc20Address], true);

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

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    await nf3User2.close();
    web3Client.closeWeb3();
  });
});
