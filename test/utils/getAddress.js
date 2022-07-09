const fs = require('fs');
const path = require('path');

module.exports = function getAddress(contract, networkId) {
  if (!networkId) throw new Error('Need to pass network ID to getAddress function');
  const contractInterface = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../deploy-contracts/build/contracts/${contract}.json`),
      'utf8',
    ),
  );

  if (!contractInterface || !contractInterface.networks) return {};
  return contractInterface.networks[networkId].address.toLowerCase();
};
