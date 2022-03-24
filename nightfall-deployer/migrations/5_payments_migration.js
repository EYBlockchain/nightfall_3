const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FeeBook = artifacts.require('FeeBook.sol');

module.exports = async function(deployer) {
  // deploy FeeBook with a minimum fee of 1
  await deployProxy(FeeBook, [1], {deployer, unsafeAllowLinkedLibraries: true }); 
};
