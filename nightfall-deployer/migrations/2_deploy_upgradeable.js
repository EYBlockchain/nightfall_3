const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Verifier = artifacts.require('Verifier.sol');
const Shield = artifacts.require('Shield.sol');
const MerkleTree_Stateless = artifacts.require('MerkleTree_Stateless.sol');
const MiMC = artifacts.require('MiMC.sol');
const Structures = artifacts.require('Structures.sol');
const Config = artifacts.require('Config.sol');
const Utils = artifacts.require('Utils.sol');
const ChallengesUtil = artifacts.require('ChallengesUtil.sol');
const Proposers = artifacts.require('Proposers.sol');
const Challenges = artifacts.require('Challenges.sol');
const State = artifacts.require('State.sol');

module.exports = async function(deployer) {
  await deployer.deploy(Verifier);
  await deployer.link(Verifier, [Challenges,ChallengesUtil]);
  await deployer.deploy(MiMC);
  await deployer.link(MiMC, MerkleTree_Stateless);
  await deployer.deploy(MerkleTree_Stateless);
  await deployer.link(MerkleTree_Stateless, [Challenges,ChallengesUtil]);
  await deployer.deploy(Utils);
  await deployer.link(Utils, [Shield,Challenges,ChallengesUtil]);
  await deployer.deploy(ChallengesUtil);
  await deployer.link(ChallengesUtil, Challenges);

  await deployProxy(Structures, [], {deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Config, [], {deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Proposers, [], {deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Challenges, [], {deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Shield, [], {deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(State, [Proposers.address, Challenges.address, Shield.address], {deployer, unsafeAllowLinkedLibraries: true });
  /*
  await deployer.deploy(Structures);
  await deployer.deploy(Config);
  await deployer.deploy(Proposers);
  await deployer.deploy(Challenges);
  await deployer.deploy(Shield);
  await deployer.deploy(State, Proposers.address, Challenges.address, Shield.address);
  */
};
