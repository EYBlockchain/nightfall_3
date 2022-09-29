const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const { networks } = require('../truffle-config.js');
const config = require('config');

const { RESTRICTIONS, MULTISIG } = config;
const { addresses } = RESTRICTIONS;
const { SIGNATURE_THRESHOLD, APPROVERS } = MULTISIG;
const { network_id } = networks[process.env.ETH_NETWORK];

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray) {
  return hexArray.sort((a, b) => {
    x = BigInt(a);
    y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0; // a bit complex because sort expects a number, not a bigint
  });
}
const sortedOwners = sortAscending(APPROVERS);

const Verifier = artifacts.require('Verifier.sol');
const Shield = artifacts.require('Shield.sol');
const MerkleTree_Stateless = artifacts.require('MerkleTree_Stateless.sol');
const Poseidon = artifacts.require('Poseidon.sol');
const Utils = artifacts.require('Utils.sol');
const ChallengesUtil = artifacts.require('ChallengesUtil.sol');
const Proposers = artifacts.require('Proposers.sol');
const Challenges = artifacts.require('Challenges.sol');
const State = artifacts.require('State.sol');
const SimpleMultiSig = artifacts.require('SimpleMultiSig.sol');

module.exports = async function (deployer) {
  await deployer.deploy(Verifier);
  await deployer.link(Verifier, [Challenges, ChallengesUtil]);
  await deployer.deploy(Poseidon);
  await deployer.link(Poseidon, MerkleTree_Stateless);
  await deployer.deploy(MerkleTree_Stateless);
  await deployer.link(MerkleTree_Stateless, [Challenges, ChallengesUtil]);
  await deployer.deploy(Utils);
  await deployer.link(Utils, [Shield, State, Challenges, ChallengesUtil]);
  await deployer.deploy(ChallengesUtil);
  await deployer.link(ChallengesUtil, Challenges);
  await deployer.deploy(SimpleMultiSig, SIGNATURE_THRESHOLD, sortedOwners, network_id);

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

  // initialisation
  const proposers = await Proposers.deployed();
  const challengers = await Challenges.deployed();
  const shield = await Shield.deployed();

  const { bootProposer, bootChallenger } = addresses;
  console.log(`Setting boot proposer ${bootProposer}...`);
  await proposers.setBootProposer(bootProposer);
  console.log(`Setting boot challenger ${bootChallenger}...`);
  await challengers.setBootChallenger(bootChallenger);
  console.log(`Setting restrictions...`);
  // restrict transfer amounts
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === 'ERC20Mock') continue; // ignore test tokens, they're already handled in the test_tokens migration
    console.log(
      `Max allowed deposit value for ${token.name}: ${(
        BigInt(token.amount) / BigInt(4)
      ).toString()}`,
    ); // BigInt division returns whole number which is a floor. Not Math.floor() needed
    console.log(`Max allowed withdraw value for ${token.name}: ${token.amount}`);
    await shield.setRestriction(
      token.address,
      (BigInt(token.amount) / BigInt(4)).toString(),
      token.amount,
    );
  }

  //set Matic Address
  const maticAddress = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
    token => token.name === 'MATIC',
  ).address;
  await shield.setMaticAddress(maticAddress.toLowerCase());
};
