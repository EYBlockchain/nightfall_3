const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

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

module.exports = async function (deployer) {
  await deployer.deploy(Verifier);
  await deployer.link(Verifier, [Challenges, ChallengesUtil]);
  await deployer.deploy(MiMC);
  await deployer.link(MiMC, MerkleTree_Stateless);
  await deployer.deploy(MerkleTree_Stateless);
  await deployer.link(MerkleTree_Stateless, [Challenges, ChallengesUtil]);
  await deployer.deploy(Utils);
  await deployer.link(Utils, [Shield, State, Challenges, ChallengesUtil]);
  await deployer.deploy(ChallengesUtil);
  await deployer.link(ChallengesUtil, Challenges);
  await upgradeProxy((await Structures.deployed()).address, Structures, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Config.deployed()).address, Config, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Proposers.deployed()).address, Proposers, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Challenges.deployed()).address, Challenges, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Shield.deployed()).address, Shield, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await State.deployed()).address, State, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
};
