const config = require('config');

const {
  UserEthereumAddresses
} = config;

const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');
const ERC721_2Mock = artifacts.require('ERC721_2Mock.sol');
const ERC1155_2Mock = artifacts.require('ERC1155_2Mock.sol');

const walletTestAddress = '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9';
const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const nERC721 = 35;

module.exports = function(deployer, _, accounts) {
  deployer.then(async () => {
    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply

    const ERC20deployed = await ERC20Mock.deployed();
    // For ping pong tests
    for (const address of UserEthereumAddresses) {
      await ERC20deployed.transfer(address, 10000000000);
    }
    // wallet tests
    if (!config.ETH_ADDRESS) {
      await deployer.deploy(ERC721Mock);
      await deployer.deploy(ERC1155Mock);
      await deployer.deploy(ERC721_2Mock);
      await deployer.deploy(ERC1155_2Mock);

      const ERC721deployed = await ERC721Mock.deployed();
      const ERC1155deployed = await ERC1155Mock.deployed();
      const ERC721_2deployed = await ERC721_2Mock.deployed();
      const ERC1155_2deployed = await ERC1155_2Mock.deployed();
      // For e2e tests
      for (let i=0; i < nERC721; i++){
        for (const address of UserEthereumAddresses) {
          await ERC721deployed.awardItem(address, `https://erc721mock/item-id-${i}.json`);
          await ERC721_2deployed.awardItem(address, `https://erc721_2mock/item-id-${i}.json`);
        }
      }
      // For testing the wallet
      await ERC20deployed.transfer(walletTestAddress, 10000000000);
      await ERC20deployed.transfer(liquidityProviderAddress, 1000000000000);
      for (let i=0; i < nERC721; i++){
        await ERC721deployed.awardItem(walletTestAddress, `https://erc721mock/item-id-${i}.json`);
      }
      for (const address of UserEthereumAddresses) {
        await ERC1155deployed.safeBatchTransferFrom(address, walletTestAddress, [0, 1, 4],
          [100000, 200000, 100000], []);
      }

      for (let i=0; i < nERC721; i++){
        await ERC721_2deployed.awardItem(walletTestAddress, `https://erc721_2mock/item-id-${i}.json`);
      }
      for (const address of UserEthereumAddresses) {
        await ERC1155_2deployed.safeBatchTransferFrom(address, walletTestAddress, [0, 1, 4],
          [100000, 200000, 100000], []);
      }
    }
  });
};
