const BN256G2 = artifacts.require('BN256G2');
const Verifier = artifacts.require('Verifier.sol');
const Shield = artifacts.require('Shield.sol');
const MerkleTree_Stateless = artifacts.require('MerkleTree_Stateless.sol');
const MiMC = artifacts.require('MiMC.sol');
const Structures = artifacts.require('Structures.sol');
const Config = artifacts.require('Config.sol');
const Utils = artifacts.require('Utils.sol');
const ChallengesUtil = artifacts.require('ChallengesUtil.sol');
const Proposers = artifacts.require('Proposers.sol');
const Challenges = artifacts.require('Challenges.sol')

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(BN256G2);
    await deployer.link(BN256G2, Verifier);
    await deployer.deploy(Verifier);
    await deployer.link(Verifier, [Challenges,ChallengesUtil]);
    await deployer.deploy(MiMC);
    await deployer.link(MiMC, MerkleTree_Stateless);
    await deployer.deploy(MerkleTree_Stateless);
    await deployer.link(MerkleTree_Stateless, [Challenges,ChallengesUtil]);
    await deployer.deploy(Structures);
    await deployer.deploy(Config);
    await deployer.deploy(Utils);
    await deployer.link(Utils, [Shield,Challenges,ChallengesUtil]);
    await deployer.deploy(ChallengesUtil);
    await deployer.link(ChallengesUtil, Challenges);
    await deployer.deploy(Proposers)
    await deployer.deploy(Challenges, Proposers.address);
    await deployer.deploy(Shield, Challenges.address);
  });
};
