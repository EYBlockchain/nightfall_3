const config = require('config');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FeeBook = artifacts.require('FeeBook.sol');
const { addresses } = config.RESTRICTIONS;

module.exports = async function (deployer) {
  // deploy FeeBook with a minimum fee of 1
  await deployProxy(FeeBook, [1, addresses.bootProposer], {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
};
