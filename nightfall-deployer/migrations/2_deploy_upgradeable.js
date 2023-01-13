const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { networks } = require('../truffle-config.js');
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
const X509 = artifacts.require('X509.sol');
const SanctionsListMock = artifacts.require('SanctionsListMock.sol');

const config = require('config');

const {
  RESTRICTIONS,
  MULTISIG,
  X509: x509Params,
  SANCTIONS_CONTRACT,
  TEST_OPTIONS: {
    addresses: { sanctionedUser },
  },
} = config;
const { addresses } = RESTRICTIONS;
const { SIGNATURE_THRESHOLD, APPROVERS } = MULTISIG;
const { network_id } = networks[process.env.ETH_NETWORK];
const { extendedKeyUsageOIDs, certificatePoliciesOIDs, RSA_TRUST_ROOTS } =
  x509Params[process.env.ETH_NETWORK];

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray) {
  return hexArray.sort((a, b) => {
    x = BigInt(a);
    y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0; // a bit complex because sort expects a number, not a bigint
  });
}
const sortedOwners = sortAscending(APPROVERS);

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

  // if we're just testing, we want to deploy a mock sanctions list. We do it here because
  // we need to know the address to give to the Shield contract
  let sanctionsContractAddress = SANCTIONS_CONTRACT;
  if (!web3.utils.isAddress(SANCTIONS_CONTRACT)) {
    await deployer.deploy(SanctionsListMock, sanctionedUser);
    sanctionsContractAddress = SanctionsListMock.address;
    console.log('SANTIONED', sanctionsContractAddress, sanctionedUser);
  }
  await deployProxy(X509, [], { deployer });
  await deployProxy(Proposers, [], { deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Challenges, [], { deployer, unsafeAllowLinkedLibraries: true });
  await deployProxy(Shield, [sanctionsContractAddress, X509.address], {
    deployer,
    unsafeAllowLinkedLibraries: true,
    initializer: 'initializeState',
  });
  await deployProxy(State, [Proposers.address, Challenges.address, Shield.address], {
    deployer,
    unsafeAllowLinkedLibraries: true,
    initializer: 'initializeState',
  });
  // initialisation
  const proposers = await Proposers.deployed();
  const challengers = await Challenges.deployed();
  const shield = await Shield.deployed();
  const x509 = await X509.deployed();
  const state = await State.deployed();
  const { bootProposer, bootChallenger } = addresses;
  await proposers.setBootProposer(bootProposer);
  await challengers.setBootChallenger(bootChallenger);
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
  // set Fee Token Address
  console.log('in 2_deploy---process.env.ETH_NETWORK----', process.env.ETH_NETWORK);
  const feeL2TokenAddress = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
    token => token.name === 'MATIC',
  ).address;
  console.log('in 2_deploy---feeL2TokenAddress----', feeL2TokenAddress);
  await shield.setFeeL2TokenAddress(feeL2TokenAddress.toLocaleLowerCase());
  await state.setFeeL2TokenAddress(feeL2TokenAddress.toLocaleLowerCase());
  console.log('Whitelisting is disabled unless it says "enabled" here:', process.env.WHITELISTING);
  if (process.env.WHITELISTING === 'enable') await x509.enableWhitelisting(true);
  // set a trusted RSA root public key for X509 certificate checks
  console.log('setting trusted public key and extended key usage OIDs');
  for (publicKey of RSA_TRUST_ROOTS) {
    const { modulus, exponent, authorityKeyIdentifier } = publicKey;
    await x509.setTrustedPublicKey({ modulus, exponent }, authorityKeyIdentifier);
  }
  for (extendedKeyUsageOIDGroup of extendedKeyUsageOIDs) {
    await x509.addExtendedKeyUsage(extendedKeyUsageOIDGroup);
  }
  for (certificatePoliciesOIDGroup of certificatePoliciesOIDs) {
    await x509.addCertificatePolicies(certificatePoliciesOIDGroup);
  }
};
