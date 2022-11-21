/* eslint-disable @babel/no-unused-expressions */
/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import crypto from 'crypto';
import axios from 'axios';
import Nf3 from '../../cli/lib/nf3.mjs';
import { NightfallMultiSig } from './nightfall-multisig.mjs';

const { WEB3_OPTIONS } = config;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, addresses } = config.TEST_OPTIONS;
const amount1 = 10;
const amount2 = 100;
const value1 = 1;
const fee = '0';
const stake = '1000000';
const { optimistApiUrl } = environment;

const getContractInstance = async (contractName, nf3) => {
  const abi = await nf3.getContractAbi(contractName);
  const contractAddress = await nf3.getContractAddress(contractName);
  const contractInstance = new nf3.web3.eth.Contract(abi, contractAddress);
  return contractInstance;
};

describe(`Testing Administrator`, () => {
  let stateContract;
  let proposersContract;
  let shieldContract;
  let challengesContract;
  let multisigContract;
  let nfMultiSig;
  const nf3User = new Nf3(signingKeys.user1, environment);

  before(async () => {
    await nf3User.init(mnemonics.user1);
    const ethPrivateKey = environment.PROPOSER_KEY;

    axios.defaults.headers.common['X-APP-TOKEN'] = crypto
      .createHash('sha256')
      .update(ethPrivateKey)
      .digest('hex');

    stateContract = await getContractInstance('State', nf3User);
    proposersContract = await getContractInstance('Proposers', nf3User);
    shieldContract = await getContractInstance('Shield', nf3User);
    challengesContract = await getContractInstance('Challenges', nf3User);
    multisigContract = await getContractInstance('SimpleMultiSig', nf3User);

    if (!(await nf3User.healthcheck('client'))) throw new Error('Healthcheck failed');
    nfMultiSig = new NightfallMultiSig(
      nf3User.web3,
      {
        state: stateContract,
        proposers: proposersContract,
        shield: shieldContract,
        challenges: challengesContract,
        multisig: multisigContract,
      },
      2,
      await nf3User.web3.eth.getChainId(),
      WEB3_OPTIONS.gas,
    );
  });

  describe(`Basic tests`, () => {
    it('Owner of State, Proposers, Shield and Challenges contracts should be the multisig', async () => {
      const ownerState = await stateContract.methods.owner().call();
      const ownerShield = await shieldContract.methods.owner().call();
      const ownerProposers = await proposersContract.methods.owner().call();
      const ownerChallenges = await challengesContract.methods.owner().call();
      const multisigAddress = multisigContract.options.address;

      expect(ownerState.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerShield.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerProposers.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerChallenges.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
    });

    it('Should set `minimumStake` to register a proposer with the multisig', async () => {
      const transactions = await nfMultiSig.setMinimumStake(
        amount2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setMinimumStake(
        amount2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const newMinimumStake = await shieldContract.methods.getMinimumStake().call();

      expect(Number(newMinimumStake)).to.be.equal(amount2);
    });

    it('Should set `blockStake` with the multisig', async () => {
      const transactions = await nfMultiSig.setBlockStake(
        amount2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setBlockStake(
        amount2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const blockStake = await shieldContract.methods.getBlockStake().call();

      expect(Number(blockStake)).to.be.equal(amount2);
    });

    it('Should set `rotateProposerBlocks` with the multisig', async () => {
      const transactions = await nfMultiSig.setRotateProposerBlocks(
        amount2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setRotateProposerBlocks(
        amount2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const rotateProposerBlocks = await shieldContract.methods.getRotateProposerBlocks().call();

      expect(Number(rotateProposerBlocks)).to.be.equal(amount2);
    });

    it('Should set `proposerSetCount` in PoS with the multisig', async () => {
      const transactions = await nfMultiSig.setProposerSetCount(
        amount1 / 2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setProposerSetCount(
        amount1 / 2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const proposerSetCount = await shieldContract.methods.getProposerSetCount().call();

      expect(Number(proposerSetCount)).to.be.equal(amount1 / 2);
    });

    it('Should set `sprintsInSpan` in PoS with the multisig', async () => {
      const transactions = await nfMultiSig.setSprintsInSpan(
        amount1 / 2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setSprintsInSpan(
        amount1 / 2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const sprintsInSpan = await shieldContract.methods.getSprintsInSpan().call();

      expect(Number(sprintsInSpan)).to.be.equal(amount1 / 2);
    });

    it(`Should set maxProposers to ${value1} in PoS with the multisig`, async () => {
      const transactions = await nfMultiSig.setMaxProposers(
        value1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setMaxProposers(
        value1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const maxProposers = await shieldContract.methods.getMaxProposers().call();

      expect(Number(maxProposers)).to.be.equal(value1);
    });

    it('Should allow to register first proposer', async () => {
      // Before registering
      const proposersBeforeRegister = await axios.get(`${optimistApiUrl}/proposer/proposers`);
      const currentProposerBefore = await axios.get(`${optimistApiUrl}/proposer/current-proposer`);

      const fProposersBeforeRegister = proposersBeforeRegister.data.proposers.filter(
        p => p.thisAddress !== currentProposerBefore.data.currentProposer,
      );

      // Register proposer
      // CHECK Why other tests do not have this env check
      if (process.env.ENVIRONMENT !== 'aws') {
        await axios.post(`${optimistApiUrl}/proposer/register`, {
          url: optimistApiUrl,
          stake,
          fee,
        });
      }

      // After registering
      const proposersAfterRegister = await axios.get(`${optimistApiUrl}/proposer/proposers`);
      const currentProposerAfter = await axios.get(`${optimistApiUrl}/proposer/current-proposer`);

      const fProposersAfterRegister = proposersAfterRegister.data.proposers.filter(
        p => p.thisAddress === currentProposerAfter.data.currentProposer,
      );

      // Assert
      expect(fProposersBeforeRegister).to.be.an('array').that.is.empty;
      expect(fProposersAfterRegister).to.have.lengthOf(1);
    });

    it.skip('Should not allow to register other proposers', async () => {
      // SKIP We need to spin a second optimist if we want to keep this test
      let error = null;
      try {
        await axios.post(`${optimistApiUrl}/proposer/register`, {
          url: optimistApiUrl,
          stake,
          fee,
        });
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    });

    it('Should set boot proposer with the multisig', async () => {
      // CHECK What is boot proposer - does this make sense in the context of a single proposer?
      const transactions = await nfMultiSig.setBootProposer(
        addresses.proposer1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setBootProposer(
        addresses.proposer1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const bootProposer = await shieldContract.methods.getBootProposer().call();

      expect(bootProposer.toUpperCase()).to.be.equal(addresses.proposer1.toUpperCase());
    });

    it('Should set boot challenger with the multisig', async () => {
      const transactions = await nfMultiSig.setBootChallenger(
        addresses.challenger,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setBootChallenger(
        addresses.challenger,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const bootChallenger = await shieldContract.methods.getBootChallenger().call();

      expect(bootChallenger.toUpperCase()).to.be.equal(addresses.challenger.toUpperCase());
    });

    it('Should set tx restrictions with the multisig', async () => {
      const transactions = await nfMultiSig.setTokenRestrictions(
        nf3User.ethereumAddress, // simulate a token address
        amount1,
        amount2,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setTokenRestrictions(
        nf3User.ethereumAddress, // simulate a token address
        amount1,
        amount2,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const restrictionDeposit = await shieldContract.methods
        .getRestrictionDeposit(nf3User.ethereumAddress)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestrictionWithdraw(nf3User.ethereumAddress)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(amount1);
      expect(Number(restrictionWithdraw)).to.be.equal(amount2);
    });

    it('Should remove tx restrictions with the multisig', async () => {
      const transactions = await nfMultiSig.removeTokenRestrictions(
        nf3User.ethereumAddress, // simulate a token address
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.removeTokenRestrictions(
        nf3User.ethereumAddress, // simulate a token address
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const restrictionDeposit = await shieldContract.methods
        .getRestrictionDeposit(nf3User.ethereumAddress)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestrictionWithdraw(nf3User.ethereumAddress)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(0);
      expect(Number(restrictionWithdraw)).to.be.equal(0);
    });

    it('Should set MATIC address with the multisig', async () => {
      const transactions = await nfMultiSig.setMaticAddress(
        addresses.user1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setMaticAddress(
        addresses.user1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const maticAddress = await shieldContract.methods.getMaticAddress().call();

      expect(maticAddress.toUpperCase()).to.be.equal(addresses.user1.toUpperCase());
    });

    it('Should pause State contract with the multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      const transactions = await nfMultiSig.pauseContracts(
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.pauseContracts(
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);

      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Should unpause State contract with the multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      const transactions = await nfMultiSig.unpauseContracts(
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.unpauseContracts(
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);

      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Should transfer ownership of contracts from multisig to a specific address', async () => {
      const transactions = await nfMultiSig.transferOwnership(
        signingKeys.user1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.transferOwnership(
        signingKeys.user1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const owner = await stateContract.methods.owner().call();
      expect(owner.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Should set `minimumStake` to register a proposer without multisig', async () => {
      await shieldContract.methods.setMinimumStake(amount2).send({ from: nf3User.ethereumAddress });
      const newMinimumStake = await shieldContract.methods.getMinimumStake().call();

      expect(Number(newMinimumStake)).to.be.equal(amount2);
    });

    it('Should set `blockStake` without multisig', async () => {
      await shieldContract.methods.setBlockStake(amount2).send({ from: nf3User.ethereumAddress });
      const blockStake = await shieldContract.methods.getBlockStake().call();

      expect(Number(blockStake)).to.be.equal(amount2);
    });

    it('Should set `rotateProposerBlocks` without multisig', async () => {
      await shieldContract.methods
        .setRotateProposerBlocks(amount2)
        .send({ from: nf3User.ethereumAddress });
      const rotateProposerBlocks = await shieldContract.methods.getRotateProposerBlocks().call();

      expect(Number(rotateProposerBlocks)).to.be.equal(amount2);
    });

    it('Should set `proposerSetCount` in PoS without multisig', async () => {
      await shieldContract.methods
        .setProposerSetCount(amount1 / 2)
        .send({ from: nf3User.ethereumAddress });
      const proposerSetCount = await shieldContract.methods.getProposerSetCount().call();

      expect(Number(proposerSetCount)).to.be.equal(amount1 / 2);
    });

    it('Should set `sprintsInSpan` in PoS without multisig', async () => {
      await shieldContract.methods
        .setSprintsInSpan(amount1 / 2)
        .send({ from: nf3User.ethereumAddress });
      const sprintsInSpan = await shieldContract.methods.getSprintsInSpan().call();

      expect(Number(sprintsInSpan)).to.be.equal(amount1 / 2);
    });

    it(`Should set maxProposers to ${amount2} in PoS without multisig`, async () => {
      await shieldContract.methods.setMaxProposers(amount2).send({ from: nf3User.ethereumAddress });
      const maxProposers = await shieldContract.methods.getMaxProposers().call();

      expect(Number(maxProposers)).to.be.equal(amount2);
    });

    it('Should set boot proposer without multisig', async () => {
      await shieldContract.methods
        .setBootProposer(addresses.proposer1)
        .send({ from: nf3User.ethereumAddress });
      const bootProposer = await shieldContract.methods.getBootProposer().call();

      expect(bootProposer.toUpperCase()).to.be.equal(addresses.proposer1.toUpperCase());
    });

    it('Should set boot challenger without multisig', async () => {
      await shieldContract.methods
        .setBootChallenger(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const bootChallenger = await shieldContract.methods.getBootChallenger().call();

      expect(bootChallenger.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Should set tx restrictions without multisig', async () => {
      await shieldContract.methods
        .setRestriction(nf3User.ethereumAddress, amount1, amount2)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContract.methods
        .getRestrictionDeposit(nf3User.ethereumAddress)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestrictionWithdraw(nf3User.ethereumAddress)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(amount1);
      expect(Number(restrictionWithdraw)).to.be.equal(amount2);
    });

    it('Should remove tx restrictions without multisig', async () => {
      await shieldContract.methods
        .removeRestriction(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContract.methods
        .getRestrictionDeposit(nf3User.ethereumAddress)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestrictionWithdraw(nf3User.ethereumAddress)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(0);
      expect(Number(restrictionWithdraw)).to.be.equal(0);
    });

    it('Should set MATIC address without multisig', async () => {
      await shieldContract.methods
        .setMaticAddress(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const maticAddress = await shieldContract.methods.getMaticAddress().call();

      expect(maticAddress.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Should pause State contract without multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      await stateContract.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Should unpause State contract without multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      await stateContract.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Should pause Shield contract without multisig', async () => {
      const paused1 = await shieldContract.methods.paused().call();
      await shieldContract.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContract.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Should unpause Shield contract without multisig', async () => {
      const paused1 = await shieldContract.methods.paused().call();
      await shieldContract.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContract.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Should restore multisig', async () => {
      const multisigAddress = multisigContract.options.address;
      await Promise.all([
        shieldContract.methods
          .transferOwnership(multisigAddress)
          .send({ from: nf3User.ethereumAddress }),
        stateContract.methods
          .transferOwnership(multisigAddress)
          .send({ from: nf3User.ethereumAddress }),
        proposersContract.methods
          .transferOwnership(multisigAddress)
          .send({ from: nf3User.ethereumAddress }),
        challengesContract.methods
          .transferOwnership(multisigAddress)
          .send({ from: nf3User.ethereumAddress }),
      ]);

      const ownerState = await stateContract.methods.owner().call();
      const ownerShield = await shieldContract.methods.owner().call();
      const ownerProposers = await proposersContract.methods.owner().call();
      const ownerChallenges = await challengesContract.methods.owner().call();
      expect(ownerState.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerShield.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerProposers.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerChallenges.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
    });
  });

  after(async () => {
    nf3User.close();
    if (process.env.ENVIRONMENT !== 'aws') {
      await axios.post(`${optimistApiUrl}/proposer/de-register`);
    }
  });
});
