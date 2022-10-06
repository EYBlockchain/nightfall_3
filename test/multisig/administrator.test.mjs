/* This test relies on nightfall_3/cli
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
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

const getContractInstance = async (contractName, nf3) => {
  const abi = await nf3.getContractAbi(contractName);
  const contractAddress = await nf3.getContractAddress(contractName);
  const contractInstance = new nf3.web3.eth.Contract(abi, contractAddress);
  return contractInstance;
};

describe(`Testing Administrator`, () => {
  let nf3User;
  let stateContract;
  let proposersContract;
  let shieldContract;
  let challengesContract;
  let multisigContract;
  let nfMultiSig;

  before(async () => {
    nf3User = new Nf3(signingKeys.user1, environment);

    await nf3User.init(mnemonics.user1);

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
    it('Owner of the State, Proposers, Shield and Challenges contract should be the multisig', async function () {
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

    it('Set boot proposer with the multisig', async () => {
      const transactions = await nfMultiSig.setBootProposer(
        signingKeys.user1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setBootProposer(
        signingKeys.user1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );
      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const bootProposer = await shieldContract.methods.getBootProposer().call();

      expect(bootProposer.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set boot challenger with the multisig', async () => {
      const transactions = await nfMultiSig.setBootChallenger(
        signingKeys.user1,
        signingKeys.user1,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        [],
      );
      const approved = await nfMultiSig.setBootChallenger(
        signingKeys.user1,
        signingKeys.user2,
        addresses.user1,
        await multisigContract.methods.nonce().call(),
        transactions,
      );

      await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
      const bootChallenger = await shieldContract.methods.getBootChallenger().call();

      expect(bootChallenger.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set restriction with the multisig', async () => {
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
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(amount1);
      expect(Number(restrictionWithdraw)).to.be.equal(amount2);
    });

    it('Remove restriction with the multisig', async () => {
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
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(0);
      expect(Number(restrictionWithdraw)).to.be.equal(0);
    });

    it('Set MATIC address with the multisig', async () => {
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

    it('Pause contracts with the multisig', async () => {
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

    it('Unpause contracts with the multisig', async () => {
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

    it('Be able to transfer ownership of contracts from multisig to a specific one', async () => {
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

    it('Set boot proposer without multisig', async () => {
      await shieldContract.methods
        .setBootProposer(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const bootProposer = await shieldContract.methods.getBootProposer().call();

      expect(bootProposer.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set boot challenger without multisig', async () => {
      await shieldContract.methods
        .setBootChallenger(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const bootChallenger = await shieldContract.methods.getBootChallenger().call();

      expect(bootChallenger.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set restriction without multisig', async () => {
      await shieldContract.methods
        .setRestriction(nf3User.ethereumAddress, amount1, amount2)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(amount1);
      expect(Number(restrictionWithdraw)).to.be.equal(amount2);
    });

    it('Remove restriction without multisig', async () => {
      await shieldContract.methods
        .removeRestriction(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContract.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(0);
      expect(Number(restrictionWithdraw)).to.be.equal(0);
    });

    it('Set MATIC address without multisig', async () => {
      await shieldContract.methods
        .setMaticAddress(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const maticAddress = await shieldContract.methods.getMaticAddress().call();

      expect(maticAddress.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Pause State contract without multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      await stateContract.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Unpause State contract without multisig', async () => {
      const paused1 = await stateContract.methods.paused().call();
      await stateContract.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContract.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Pause Shield contract without multisig', async () => {
      const paused1 = await shieldContract.methods.paused().call();
      await shieldContract.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContract.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Unpause Shield contract without multisig', async () => {
      const paused1 = await shieldContract.methods.paused().call();
      await shieldContract.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContract.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Restore multisig', async () => {
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
  });
});