const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { networks } = require('../truffle-config.js');
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
const SimpleMultiSig = artifacts.require('SimpleMultiSig.sol');

const config = require('config');

const { RESTRICTIONS, MULTISIG, owners } = config;
const { addresses } = RESTRICTIONS;
const { SIGNATURE_THRESHOLD, OWNERS} = MULTISIG
const { network_id } = networks[process.env.ETH_NETWORK];

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray) {
  return hexArray.sort((a, b) => {
    x = BigInt(a);
    y = BigInt(b);
    (x < y) ? -1 : ((x > y) ? 1 : 0)}); // a bit complex because sort expects a number, not a bigint
}
const sortedOwners = sortAscending(OWNERS);

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
  await deployer.deploy(SimpleMultiSig, SIGNATURE_THRESHOLD, sortedOwners, network_id);

  await deployProxy(Proposers, [], { deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Challenges, [], { deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Shield, [], { deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(State, [Proposers.address, Challenges.address, Shield.address], {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });

  const proposers = await Proposers.deployed();
  const challengers = await Challenges.deployed();
  const { bootProposer, bootChallenger } = addresses;
  await proposers.setBootProposer(bootProposer);
  await challengers.setBootChallenger(bootChallenger);
  const restrictions = await Shield.deployed();
  // restrict transfer amounts
  for (let token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name = 'ERC20Mock') break; // ignore test tokens, they're already handled in the test_tokens migration
    console.log(`Max allowed deposit value for ${token.name}: ${(BigInt(token.amount) / BigInt(4)).toString()}`); // BigInt division returns whole number which is a floor. Not Math.floor() needed
    console.log(`Max allowed withdraw value for ${token.name}: ${token.amount}`);
    await restrictions.setRestriction(token.address, (BigInt(token.amount) / BigInt(4)).toString(), token.amount);
  }
};
