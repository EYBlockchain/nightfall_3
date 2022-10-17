const config = require('config');

const {
  TEST_OPTIONS: { addresses },
  RESTRICTIONS,
} = config;
const { DEPLOY_MOCK_TOKENS = true } = process.env;

const Shield = artifacts.require('Shield.sol');

const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');

const liquidityProviderAddress = '0x4789FD18D5d71982045d85d5218493fD69F55AC4';
const nERC721 = 35;

module.exports = function (deployer, _, accounts) {
  deployer.then(async () => {
    const shield = await Shield.deployed();

    if (DEPLOY_MOCK_TOKENS === 'false') return;

    await deployer.deploy(ERC20Mock, 1001010000000000); // initialSupply

    const ERC20deployed = await ERC20Mock.deployed();
    // For ping pong tests
    await ERC20deployed.transfer(addresses.user1, 1000000000000);
    await ERC20deployed.transfer(addresses.user2, 1000000000000);
    await ERC20deployed.transfer(shield.address, 1000000000000); // for testing Shield balance withdraw

    // set restictions for test ERC20Mock contract (we handle this differently because the address is not fixed)
    // set payment address to ERC20Mock contract
    try {
      const erc20Mock = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
        el => el.name === 'ERC20Mock',
      );
      await shield.setRestriction(
        ERC20Mock.address,
        (BigInt(erc20Mock.amount) / BigInt(4)).toString(),
        erc20Mock.amount,
      );
    } catch (err) {
      console.warn(
        'Test contract restrictions were not set, and yet you have deployed test contracts',
      );
    }

    if (!config.ETH_ADDRESS) {
      //modify the matic address to be ERCMock for tests
      await shield.setMaticAddress(ERC20deployed.address.toLowerCase());

      // indicates we're running a wallet test that uses hardcoded addresses
      // For e2e tests
      // For e2e tests
      // For testing the wallet
      await ERC20deployed.transfer(liquidityProviderAddress, 1000000000000);
    }
  });
};
