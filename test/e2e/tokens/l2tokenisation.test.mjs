/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
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

const { generalise } = gen;

const { BN128_GROUP_ORDER, SHIFT } = constants;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
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
    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
    stateAddress = await nf3Users[0].stateContractAddress;
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

    await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, 0);
    await makeBlock();
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
      await makeBlock();

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
      await makeBlock();

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, [commitmentHash], 1);
      await makeBlock();

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
      await makeBlock();

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, value, privateTokenId, [commitmentHash], 1);
      await makeBlock();

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
      await makeBlock();

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, [], 1);
      await makeBlock();

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(-valueBurnt);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    web3Client.closeWeb3();
  });
});
