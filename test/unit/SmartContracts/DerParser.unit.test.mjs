import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';

import makeTlv from '../utils/tlv.mjs';

const { ethers } = hardhat;

describe('DerParser contract functions', function () {
  let derBuffer;
  let DerParserInstance;
  before(async () => {
    derBuffer = fs.readFileSync('test/unit/utils/root.der');
    const DerParserDeployer = await ethers.getContractFactory('DERParser');
    DerParserInstance = await DerParserDeployer.deploy();
  });
  it('Should parse the root cert der file', async function () {
    await DerParserInstance.parseDER(derBuffer);
    const tlvs = (await DerParserInstance.getTlvs()).map(tlv => makeTlv(tlv));
    console.log(tlvs);
  });
  /*
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
    */
});
