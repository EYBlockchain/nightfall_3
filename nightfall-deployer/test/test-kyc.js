const { expect } = require('chai');
const hardhat = require('hardhat');

const { ethers } = hardhat;

describe('KYC contract', function () {
  let KYCInstance;
  beforeEach(async () => {
    const KYCDeployer = await ethers.getContractFactory('KYC');
    KYCInstance = await KYCDeployer.deploy();
    await KYCInstance.deployed();
    // await KYCInstance.initialize();
    await console.log('OWNER', await KYCInstance.owner());
  });
  afterEach(async () => {
    // clear down the test network after each test
    await hardhat.network.provider.send('hardhat_reset');
  });
  it('Deployment should set whitelisting to false', async function () {
    const whitelisting = await KYCInstance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(false);
    const owners = await ethers.getSigners();
    // as whitelisting is turned off, everyone shoudl appear to be whitelisted
    expect(await KYCInstance.isWhitelisted(owners[0].address)).to.equal(true);
  });
  it('Turning on whitelisting and creating a whitelisted user by a non-manager should fail', async function () {
    await KYCInstance.setWhitelisting(true);
    const whitelisting = await KYCInstance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(true);
    const owners = await ethers.getSigners();
    await KYCInstance.addUserToWhitelist(owners[1].address);
    expect(await KYCInstance.isWhitelisted(owners[1].address)).to.equal(false);
  });
});
