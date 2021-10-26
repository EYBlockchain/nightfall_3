const ERC20Mock = artifacts.require('ERC20Mock.sol');
const ERC721Mock = artifacts.require('ERC721Mock.sol');
const ERC1155Mock = artifacts.require('ERC1155Mock.sol');

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(ERC20Mock, 1000000000); // initialSupply = 1000000000
    await deployer.deploy(ERC721Mock);
    await deployer.deploy(ERC1155Mock);
  });
};
