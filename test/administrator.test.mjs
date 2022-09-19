/* This test relies on nightfall_3/cli
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import contractABIs from './contracts.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;

const getContractInstance = async (contractName, nf3) => {
  const abi = contractABIs[contractName];
  const contractAddress = await nf3.getContractAddress(contractName);
  const contractInstance = new nf3.web3.eth.Contract(abi, contractAddress);
  return contractInstance;
};

describe(`Testing Administrator`, () => {
  let nf3User;
  let stateContractInstance;
  let proposersContractInstance;
  let shieldContractInstance;
  let challengesContractInstance;

  before(async () => {
    nf3User = new Nf3(signingKeys.user1, environment);

    await nf3User.init(mnemonics.user1);

    stateContractInstance = await getContractInstance('State', nf3User);
    proposersContractInstance = await getContractInstance('Proposers', nf3User);
    shieldContractInstance = await getContractInstance('Shield', nf3User);
    challengesContractInstance = await getContractInstance('Challenges', nf3User);

    if (!(await nf3User.healthcheck('client'))) throw new Error('Healthcheck failed');
  });

  describe(`Basic tests`, () => {
    it('Owner of the State, Proposers, Shield and Challenges contract should be the multisig', async function () {
      const ownerState = await stateContractInstance.methods.owner().call();
      const ownerShield = await shieldContractInstance.methods.owner().call();
      const ownerProposers = await proposersContractInstance.methods.owner().call();
      const ownerChallenges = await challengesContractInstance.methods.owner().call();
      const multisigAddress = await nf3User.getContractAddress('SimpleMultiSig');

      if (ownerState.toUpperCase() !== multisigAddress.toUpperCase()) this.skip();
      // console.log(ownerState, multisigAddress);
      expect(ownerState.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerShield.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerProposers.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
      expect(ownerChallenges.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
    });

    /* it('Be able to transfer ownership of contracts from multisig to a specific one', async () => {
      // TODO: calls to multisig to change contracts ownership. Now you can do it manually through nightfall-administrator
      const owner = await stateContractInstance.methods.owner().call();
      expect(owner.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    }); */

    it('Set boot proposer', async () => {
      await shieldContractInstance.methods
        .setBootProposer(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const bootProposer = await shieldContractInstance.methods.getBootProposer().call();

      expect(bootProposer.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set boot challenger', async () => {
      await shieldContractInstance.methods
        .setBootChallenger(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const bootChallenger = await shieldContractInstance.methods.getBootChallenger().call();

      expect(bootChallenger.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Set restriction', async () => {
      await shieldContractInstance.methods
        .setRestriction(nf3User.ethereumAddress, 10, 100)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContractInstance.methods
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContractInstance.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(10);
      expect(Number(restrictionWithdraw)).to.be.equal(100);
    });

    it('Remove restriction', async () => {
      await shieldContractInstance.methods
        .removeRestriction(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const restrictionDeposit = await shieldContractInstance.methods
        .getRestriction(nf3User.ethereumAddress, 0)
        .call();
      const restrictionWithdraw = await shieldContractInstance.methods
        .getRestriction(nf3User.ethereumAddress, 1)
        .call();

      expect(Number(restrictionDeposit)).to.be.equal(0);
      expect(Number(restrictionWithdraw)).to.be.equal(0);
    });

    it('Set MATIC address', async () => {
      await shieldContractInstance.methods
        .setMaticAddress(nf3User.ethereumAddress)
        .send({ from: nf3User.ethereumAddress });
      const maticAddress = await shieldContractInstance.methods.getMaticAddress().call();

      expect(maticAddress.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    });

    it('Pause State contract', async () => {
      const paused1 = await stateContractInstance.methods.paused().call();
      await stateContractInstance.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContractInstance.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Unpause State contract', async () => {
      const paused1 = await stateContractInstance.methods.paused().call();
      await stateContractInstance.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await stateContractInstance.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });

    it('Pause Shield contract', async () => {
      const paused1 = await shieldContractInstance.methods.paused().call();
      await shieldContractInstance.methods.pause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContractInstance.methods.paused().call();

      expect(paused1).to.be.equal(false);
      expect(paused2).to.be.equal(true);
    });

    it('Unpause Shield contract', async () => {
      const paused1 = await shieldContractInstance.methods.paused().call();
      await shieldContractInstance.methods.unpause().send({ from: nf3User.ethereumAddress });
      const paused2 = await shieldContractInstance.methods.paused().call();

      expect(paused1).to.be.equal(true);
      expect(paused2).to.be.equal(false);
    });
  });

  after(async () => {
    nf3User.close();
  });
});
