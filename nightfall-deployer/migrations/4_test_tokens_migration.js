const config = require('config');

const {
  UserEthereumAddresses
} = config;

const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');

const walletTestAddress = '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9';
const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const ilyas = '0x9C8B2276D490141Ae1440Da660E470E7C0349C63';
const nERC721 = 35;

module.exports = function(deployer, _, accounts) {
  deployer.then(async () => {
    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply

    const ERC20deployed = await ERC20Mock.deployed();
    // For ping pong tests
    for (const address of UserEthereumAddresses) {
      await ERC20deployed.transfer(address, 1000000);
    }
    if (!config.ETH_ADDRESS) {// indicates we're running a wallet test that uses hardcoded addresses
      // For e2e tests
      await deployer.deploy(ERC721Mock);
      await deployer.deploy(ERC1155Mock);
      const ERC721deployed = await ERC721Mock.deployed();
      const ERC1155deployed = await ERC1155Mock.deployed();

      for (let i=0; i < nERC721; i++){
        for (const address of UserEthereumAddresses) {
          await ERC721deployed.awardItem(address, `https://erc721mock/item-id-${i}.json`);
        }
        await ERC721deployed.awardItem(walletTestAddress, `https://erc721mock/item-id-${i}.json`);
      }
      // For testing the wallet
      await ERC20deployed.transfer(walletTestAddress, 10000000000);
      await ERC20deployed.transfer(liquidityProviderAddress, 1000000000000);
      await ERC20deployed.transfer(ilyas, 1000000000000);

      await ERC1155deployed.safeBatchTransferFrom(accounts[0], walletTestAddress, [0, 1, 4],
        [100000, 200000, 100000], []);

      for (const address of UserEthereumAddresses) {
         await ERC1155deployed.safeBatchTransferFrom(accounts[0], address, [0, 1, 4],
           [100000, 200000, 100000], []);
      }
    }
  });
};
