/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import gen from 'general-number';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { /* expectTransaction, */ emptyL2, Web3Client } from '../../utils.mjs';
import Commitment from '../../../nightfall-client/src/classes/commitment.mjs';

// so we can use require with mjs file
// const { expect } = chai;
const { generalise } = gen;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { BN128_GROUP_ORDER } = constants;

const {
  txPerBlock,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

// why do we need an ERC20 token in an ERC721 test, you ask?
// let me tell you I also don't know, but I guess we just want to fill some blocks?
let erc20Address;
let l2Address;
let stateAddress;
const eventLogs = [];

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
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);

    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
    const randomAddress = await randValueLT(1461501637330902918203684832716283019655932542976n);

    l2Address = generalise(
      randomAddress.bigInt +
        21711016731996786641919559689128982722488122124807605757398297001483711807488n,
    ).hex(32);

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await nf3Users[0].deposit(erc20Address, tokenType, transferValue, tokenId, 0);

    await emptyL2(nf3Users[0], web3Client, eventLogs);
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
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

      await emptyL2(nf3Users[0], web3Client, eventLogs);

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

      const commitment = new Commitment({
        ercAddress: l2Address,
        tokenId: privateTokenId,
        value,
        salt: salt.hex(),
        zkpPublicKey: nf3Users[0].zkpKeys.zkpPublicKey,
      });

      const commitmentHash = commitment.hash.hex(32);
      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2(nf3Users[0], web3Client, eventLogs);

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, [commitmentHash], 1);

      await emptyL2(nf3Users[0], web3Client, eventLogs);

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

      const commitment = new Commitment({
        ercAddress: l2Address,
        tokenId: privateTokenId,
        value,
        salt: salt.hex(),
        zkpPublicKey: nf3Users[0].zkpKeys.zkpPublicKey,
      });

      const commitmentHash = commitment.hash.hex(32);
      await nf3Users[0].tokenise(l2Address, value, privateTokenId, salt.hex(), 1);

      await emptyL2(nf3Users[0], web3Client, eventLogs);

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, value, privateTokenId, [commitmentHash], 1);

      await emptyL2(nf3Users[0], web3Client, eventLogs);

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

      await emptyL2(nf3Users[0], web3Client, eventLogs);

      const beforeBalance = await nf3Users[0].getLayer2Balances();

      const erc20AddressBalanceBefore = beforeBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceBefore =
        beforeBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;

      await nf3Users[0].burn(l2Address, valueBurnt, privateTokenId, [], 1);

      await emptyL2(nf3Users[0], web3Client, eventLogs);

      const afterBalance = await nf3Users[0].getLayer2Balances();
      const erc20AddressBalanceAfter = afterBalance[erc20Address]?.[0].balance || 0;
      const l2AddressBalanceAfter =
        afterBalance[l2Address]?.find(e => e.tokenId === generalise(privateTokenId).hex(32))
          ?.balance || 0;
      expect(l2AddressBalanceAfter - l2AddressBalanceBefore).to.be.equal(-valueBurnt);
      expect(erc20AddressBalanceAfter - erc20AddressBalanceBefore).to.be.equal(-1);
    });
  });
});
