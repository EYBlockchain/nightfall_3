const ERCStub = artifacts.require('ERCStub.sol');
const ERC721Stub = artifacts.require('ERC721Stub.sol');
const ERC1155Stub = artifacts.require('ERC1155Stub.sol');

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(ERCStub);
    await deployer.deploy(ERC721Stub);
    await deployer.deploy(ERC1155Stub);
  });
};
