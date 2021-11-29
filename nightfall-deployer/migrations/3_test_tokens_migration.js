const config = require('config');

const {
  UserEthereumAddresses,
  TEST_OPTIONS: {
    restrictions: { erc20default },
  },
} = config;

const Shield = artifacts.require('Shield.sol');

const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');

const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const nERC721 = 35;

module.exports = function (deployer, _, accounts) {
  deployer.then(async () => {
    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply

    const restrictions = await Shield.deployed();
    const ERC20deployed = await ERC20Mock.deployed();

    // For ping pong tests
    for (const address of UserEthereumAddresses) {
      await ERC20deployed.transfer(address, 1000000000000);
    }
    // Set a restriction for ping-pong
    await restrictions.setRestriction(ERC20deployed.address, erc20default);

    if (!config.ETH_ADDRESS) {
      // indicates we're running a wallet test that uses hardcoded addresses
      // For e2e tests
      await deployer.deploy(ERC721Mock);
      await deployer.deploy(ERC1155Mock);
      const ERC721deployed = await ERC721Mock.deployed();
      const ERC1155deployed = await ERC1155Mock.deployed();
      // For e2e tests
      for (let i = 0; i < nERC721; i++) {
        for (const address of UserEthereumAddresses) {
          await ERC721deployed.awardItem(address, `https://erc721mock/item-id-${i}.json`);
        }
      }
      // For testing the wallet
      await ERC20deployed.transfer(liquidityProviderAddress, 1000000000000);

      for (const address of UserEthereumAddresses) {
        await ERC1155deployed.safeBatchTransferFrom(
          accounts[0],
          address,
          [0, 1, 2, 3, 4],
          [100000, 200000, 2, 50, 80000],
          [],
        );
      }
    }
  });
};