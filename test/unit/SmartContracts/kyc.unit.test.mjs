import { expect } from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

describe('Shield contract Shield functions', function () {
  let ShieldInstance;
  beforeEach(async () => {
    const ShieldDeployer = await ethers.getContractFactory('Shield');
    ShieldInstance = await ShieldDeployer.deploy();
    await ShieldInstance.deployed();
    await ShieldInstance.initialize();
  });
  afterEach(async () => {
    // clear down the test network after each test
    await hardhat.network.provider.send('hardhat_reset');
  });
  it('Deployment should set whitelisting to false', async function () {
    const whitelisting = await ShieldInstance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(false);
    const owners = await ethers.getSigners();
    // as whitelisting is turned off, everyone shoudl appear to be whitelisted
    expect(await ShieldInstance.isWhitelisted(owners[0].address)).to.equal(true);
  });
  it('Turning on whitelisting and creating a whitelisted user by a non-manager should fail', async function () {
    await ShieldInstance.enableWhitelisting(true);
    const whitelisting = await ShieldInstance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(true);
    const owners = await ethers.getSigners();
    await ShieldInstance.addUserToWhitelist(owners[1].address);
    expect(await ShieldInstance.isWhitelisted(owners[1].address)).to.equal(false);
  });
  it('Turning on whitelisting and creating a whitelisted user by a whitelist manager should succeed', async function () {
    const MANAGER_GROUP = 42;
    await ShieldInstance.enableWhitelisting(true);
    const whitelisting = await ShieldInstance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(true);
    const owners = await ethers.getSigners();
    await ShieldInstance.createWhitelistManager(MANAGER_GROUP, owners[0].address);
    expect((await ShieldInstance.isWhitelistManager(owners[0].address)).toNumber()).to.equal(
      MANAGER_GROUP,
    );
    await ShieldInstance.addUserToWhitelist(owners[2].address);
    expect(await ShieldInstance.isWhitelisted(owners[2].address)).to.equal(true);
  });
});
