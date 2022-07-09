const setRestriction = require('../setRestrictions.js');

module.exports = function (deployer, _, accounts) {
  deployer.then(async () => {
    const { shieldAddress } = await setRestriction();
  });
};
