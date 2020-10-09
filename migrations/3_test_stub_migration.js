const ERCStub = artifacts.require('ERCStub.sol');

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(ERCStub);
  });
};
