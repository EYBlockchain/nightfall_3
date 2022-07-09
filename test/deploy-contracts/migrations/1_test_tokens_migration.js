const config = require('config');
const setRestriction = require('../setRestrictions.js');

const {
  TEST_OPTIONS: { addresses },
  RESTRICTIONS,
} = config;
const { DEPLOY_MOCK_TOKENS = true } = process.env;

// const Shield = artifacts.require('../../nightfall-deployer/contracts/Shield.sol');

const ERC20Mock = artifacts.require('contracts/mocks/ERC20Mock.sol');
const ERC721Mock = artifacts.require('contracts/mocks/ERC721Mock.sol');
const ERC1155Mock = artifacts.require('contracts/mocks/ERC1155Mock.sol');

const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const nERC721 = 35;

module.exports = function (deployer, _, accounts) {
  deployer.then(async () => {
    // const restrictions = await Shield.deployed();

    if (DEPLOY_MOCK_TOKENS === 'false') return;

    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply

    const ERC20deployed = await ERC20Mock.deployed();

    // For ping pong tests
    await ERC20deployed.transfer(addresses.user1, 1000000000000);
    await ERC20deployed.transfer(addresses.user2, 1000000000000);

    // // set restictions for test ERC20Mock contract (we handle this differently because the address is not fixed)
    // try {
    //   const erc20MockRestriction = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
    //     el => el.name === 'ERC20Mock',
    //   ).amount;
    //   await restrictions.setRestriction(
    //     ERC20Mock.address,
    //     (BigInt(erc20MockRestriction) / BigInt(4)).toString(),
    //     erc20MockRestriction,
    //   );
    // } catch (err) {
    //   console.warn(
    //     'Test contract restrictions were not set, and yet you have deployed test contracts',
    //   );
    // }

    if (!config.ETH_ADDRESS) {
      // indicates we're running a wallet test that uses hardcoded addresses
      // For e2e tests
      await deployer.deploy(ERC721Mock);
      await deployer.deploy(ERC1155Mock);
      const ERC721deployed = await ERC721Mock.deployed();
      const ERC1155deployed = await ERC1155Mock.deployed();
      // For e2e tests
      for (let i = 0; i < nERC721; i++) {
        await ERC721deployed.awardItem(addresses.user1, `https://erc721mock/item-id-${i}.json`);
      }
      // For testing the wallet
      await ERC20deployed.transfer(liquidityProviderAddress, 1000000000000);

      await ERC1155deployed.safeBatchTransferFrom(
        accounts[0],
        addresses.user1,
        [0, 1, 2, 3, 4],
        [100000, 200000, 2, 50, 80000],
        [],
      );
    }
  });
};
