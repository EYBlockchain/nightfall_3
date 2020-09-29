/* eslint-disable babel/camelcase, no-undef */

// const MiMC_BLS12_377 = artifacts.require('MiMC_BLS12_377');
const Verifier_GM17_BLS12_377 = artifacts.require('Verifier_GM17_BLS12_377');
const Verifier_GM17_BW6_761 = artifacts.require('Verifier_GM17_BW6_761');
const ZVM = artifacts.require('ZVM');

module.exports = deployer => {
  deployer.then(async () => {
    // await deployer.deploy(MiMC_BLS12_377);
    await deployer.deploy(Verifier_GM17_BLS12_377);
    await deployer.deploy(Verifier_GM17_BW6_761);
    await deployer.deploy(
      ZVM, //
      Verifier_GM17_BW6_761.address,
      Verifier_GM17_BLS12_377.address,
      { gas: 10000000 },
    );
  });
};
