import { ethers, upgrades, network } from 'hardhat';
import { MULTISIG, RESTRICTIONS, TEST_OPTIONS, ETH_ADDRESS } from 'config';

async function main() {
  const Proposers = await ethers.getContractFactory('Proposers');
  const proposers = await upgrades.deployProxy(Proposers, []);
  await proposers.deployed();
  console.log(`Proposers deployed to\t\t${proposers.address}`);

  const Verifier = await ethers.getContractFactory('Verifier');
  const verifier = await Verifier.deploy();
  await verifier.deployed();
  console.log(`Verifier deployed to\t\t${verifier.address}`);

  const Poseidon = await ethers.getContractFactory('Poseidon');
  const poseidon = await Poseidon.deploy();
  await poseidon.deployed();
  console.log(`Poseidon deployed to\t\t${poseidon.address}`);

  const MerkleTree = await ethers.getContractFactory('MerkleTree_Stateless', {
    libraries: {
      Poseidon: poseidon.address,
    },
  });
  const merkleTree = await MerkleTree.deploy();
  await merkleTree.deployed();
  console.log(`MerkleTree deployed to\t\t${merkleTree.address}`);

  const ChallengesUtil = await ethers.getContractFactory('ChallengesUtil', {
    libraries: {
      MerkleTree_Stateless: merkleTree.address,
    },
  });
  const challengesUtil = await ChallengesUtil.deploy();
  await challengesUtil.deployed();
  console.log(`ChallengesUtil deployed to\t${challengesUtil.address}`);

  const Challenges = await ethers.getContractFactory('Challenges', {
    libraries: {
      Verifier: verifier.address,
      ChallengesUtil: challengesUtil.address,
    },
  });
  const challenges = await upgrades.deployProxy(Challenges, [], {
    unsafeAllow: ['external-library-linking'],
  });
  await challenges.deployed();
  console.log(`Challenges deployed to\t\t${challenges.address}`);

  const Shield = await ethers.getContractFactory('Shield');
  const shield = await upgrades.deployProxy(Shield, []);
  await shield.deployed();
  console.log(`Shield deployed to\t\t${shield.address}`);

  const Utils = await ethers.getContractFactory('Utils');
  const utils = await Utils.deploy();
  await utils.deployed();
  console.log(`Utils deployed to\t\t${utils.address}`);

  const State = await ethers.getContractFactory('State', {
    libraries: {
      Utils: utils.address,
    },
  });
  const state = await upgrades.deployProxy(
    State,
    [proposers.address, challenges.address, shield.address],
    {
      initializer:
        'initialize(address _proposersAddress, address _challengesAddress, address _shieldAddress)',
      unsafeAllow: ['external-library-linking'],
    },
  );
  await state.deployed();
  console.log(`State deployed to\t\t${state.address}`);

  const { SIGNATURE_THRESHOLD, APPROVERS } = MULTISIG;
  const SimpleMultiSig = await ethers.getContractFactory('SimpleMultiSig');
  const simpleMultiSig = await SimpleMultiSig.deploy(
    SIGNATURE_THRESHOLD,
    sortAscending(APPROVERS),
    network.config.chainId!,
  );
  await simpleMultiSig.deployed();
  console.log(`SimpleMultiSig deployed to\t${simpleMultiSig.address}`);

  // TODO: move initialization to different script
  const {
    addresses: { bootProposer, bootChallenger },
  } = RESTRICTIONS;
  await proposers.setBootProposer(bootProposer);
  await challenges.setBootChallenger(bootChallenger);

  // TODO: this should depend on network.name instead of process.env.ETH_NETWORK
  for (const token of RESTRICTIONS.tokens['blockchain']) {
    // ignore test tokens, they're already handled in the test_tokens migration
    if (token.name === 'ERC20Mock') continue;
    console.log(
      `Max allowed deposit value for ${token.name}: ${(
        BigInt(token.amount) / BigInt(4)
      ).toString()}`,
    );
    console.log(`Max allowed withdraw value for ${token.name}: ${token.amount}`);
    await shield.setRestriction(
      token.address,
      (BigInt(token.amount) / BigInt(4)).toString(),
      token.amount,
    );
  }

  // TODO: this should depend on network.name instead of process.env.ETH_NETWORK
  const maticAddress = RESTRICTIONS.tokens['blockchain'].find(
    (t: any) => t.name === 'MATIC',
  ).address;
  await shield.setMaticAddress(maticAddress);

  // TODO: move mock token setup to seperate file
  // deployment of mock tokens can also depend on the network name
  // instead of a dedicated env variable
  if (network.name !== 'hardhat') return;

  const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
  const erc20Mock = await ERC20Mock.deploy(1001010000000000);
  await erc20Mock.deployed();
  console.log(`ERC20Mock deployed to\t\t${erc20Mock.address}`);

  // fund users for ping-pong test
  const { addresses } = TEST_OPTIONS;
  erc20Mock.transfer(addresses.user1, 1000000000000);
  erc20Mock.transfer(addresses.user2, 1000000000000);
  erc20Mock.transfer(shield.address, 1000000000000);

  // set mock token restrictions
  // this is done seperately since the address dynamic
  const restrictionAmount = RESTRICTIONS.tokens['blockchain'].find(
    (t: any) => t.name === 'ERC20Mock',
  ).amount;
  await shield.setRestriction(
    erc20Mock.address,
    (BigInt(restrictionAmount) / BigInt(4)).toString(),
    restrictionAmount,
  );

  if (!ETH_ADDRESS) {
    // indicates we're running 2e2 tests that uses hardcoded addresses
    const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
    await shield.setMaticAddress(erc20Mock.address);

    const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
    const erc721Mock = await ERC721Mock.deploy();
    await erc721Mock.deployed();
    console.log(`ERC721Mock deployed to\t\t${erc721Mock.address}`);

    const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
    const erc1155Mock = await ERC1155Mock.deploy();
    await erc1155Mock.deployed();
    console.log(`ERC1155Mock deployed to\t\t${erc1155Mock.address}`);

    for (let i = 0; i < 35; i++) {
      await erc721Mock.awardItem(addresses.user1, `https://erc721mock/item-id-${i}.json`);
    }

    await erc20Mock.transfer(liquidityProviderAddress, 1000000000000);
    await erc1155Mock.safeBatchTransferFrom(
      (
        await ethers.getSigners()
      )[0].address,
      addresses.user1,
      [0, 1, 2, 3, 4],
      [100000, 200000, 10, 50, 80000],
      [],
    );
  }

  // TODO: contract setup scripts
  [proposers, shield, challenges].forEach(contract => contract.setStateContract(state.address));
  [proposers, shield, challenges, state].forEach(contract =>
    contract.transferOwnership(simpleMultiSig.address),
  );
  // TODO: support upgrades // port migration 4
}

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray: string[]) {
  return hexArray.sort((a: string, b: string) => {
    const x = BigInt(a);
    const y = BigInt(b);
    // a bit complex because sort expects a number, not a bigint
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
