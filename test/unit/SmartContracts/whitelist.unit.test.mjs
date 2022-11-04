import { expect } from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

describe('X509 contract Whitelisting functions', function () {
  let X509Instance;
  beforeEach(async () => {
    const X509Deployer = await ethers.getContractFactory('X509');
    X509Instance = await X509Deployer.deploy();
    await X509Instance.deployed();
    await X509Instance.initialize();
  });
  afterEach(async () => {
    // clear down the test network after each test
    await hardhat.network.provider.send('hardhat_reset');
  });
  it('Deployment should set whitelisting to false', async function () {
    const whitelisting = await X509Instance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(false);
    const owners = await ethers.getSigners();
    // as whitelisting is turned off, everyone shoudl appear to be whitelisted
    expect(await X509Instance.isWhitelisted(owners[0].address)).to.equal(true);
  });
  it('Turning on whitelisting and creating a whitelisted user by a non-manager should fail', async function () {
    await X509Instance.enableWhitelisting(true);
    const whitelisting = await X509Instance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(true);
    const owners = await ethers.getSigners();
    await X509Instance.addUserToWhitelist(owners[1].address);
    expect(await X509Instance.isWhitelisted(owners[1].address)).to.equal(false);
  });
  it('Turning on whitelisting and creating a whitelisted user by a whitelist manager should succeed', async function () {
    const MANAGER_GROUP = 42;
    await X509Instance.enableWhitelisting(true);
    const whitelisting = await X509Instance.whitelisting();
    expect(whitelisting).to.be.a('boolean');
    expect(whitelisting).to.equal(true);
    const owners = await ethers.getSigners();
    await X509Instance.createWhitelistManager(MANAGER_GROUP, owners[0].address);
    expect((await X509Instance.isWhitelistManager(owners[0].address)).toNumber()).to.equal(
      MANAGER_GROUP,
    );
    await X509Instance.addUserToWhitelist(owners[2].address);
    expect(await X509Instance.isWhitelisted(owners[2].address)).to.equal(true);
  });
});
