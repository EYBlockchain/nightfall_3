const config = require('config');

const {
  UserEthereumAddresses
} = config;

const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');

// const recipientAddress = '0x9c8b2276d490141ae1440da660e470e7c0349c63';
const walletTestAddress = '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9';
const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const nERC721 = 100;

module.exports = function(deployer, _, accounts) {
  deployer.then(async () => {
    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply
    await deployer.deploy(ERC721Mock);
    await deployer.deploy(ERC1155Mock);

    const ERC20deployed = await ERC20Mock.deployed();
    // For ping pong tests
    for (const address of UserEthereumAddresses) {
      await ERC20deployed.transfer(address, 10000000000);
    }
    // wallet tests
    if (!config.ETH_ADDRESS) {
      await deployer.deploy(ERC721Mock);
      await deployer.deploy(ERC1155Mock);

      const ERC721deployed = await ERC721Mock.deployed();
      const ERC1155deployed = await ERC1155Mock.deployed();
      // For e2e tests
      for (let i=0; i < nERC721; i++){
        await ERC721deployed.awardItem(accounts[0], `https://erc721mock/item-id-${i}.json`);
      }
      // For testing the wallet
      await ERC20deployed.transfer(walletTestAddress, 10000000000);
      await ERC20deployed.transfer(liquidityProviderAddress, 10000000000);
      for (let i=0; i < 100; i++){
        await ERC721deployed.awardItem(walletTestAddress, `https://erc721mock/item-id-${i}.json`);
      }
      await ERC1155deployed.safeBatchTransferFrom(accounts[0], walletTestAddress, [0, 1, 4],
        [5000000, 200000, 100000], []);
    }
  });
};