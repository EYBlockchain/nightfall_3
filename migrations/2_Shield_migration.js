const BN256G2 = artifacts.require('BN256G2');
const Verifier = artifacts.require('Verifier.sol');
const Shield = artifacts.require('Shield.sol');

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(BN256G2);
    await deployer.link(BN256G2, [Verifier]);
    await deployer.deploy(Verifier);
    await deployer.deploy(Shield, Verifier.address);
  });
};
