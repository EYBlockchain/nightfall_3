import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import crypto from 'crypto';

import { makeTlv, signEthereumAddress } from '../utils/x509.mjs';

const { ethers } = hardhat;

describe('DerParser contract functions', function () {
  let X509Instance;
  let signature;
  let addressToSign;
  const derPrivateKey = fs.readFileSync('test/unit/utils/Nightfall_end_user.der');
  const certChain = []; // contains the certificate to verify chain, lowest index is lowest cert in chain (i.e. [0] = end user)
  before(async () => {
    const X509Deployer = await ethers.getContractFactory('X509');
    const ShieldDeployer = await ethers.getContractFactory('Shield');
    let derBuffer;
    let tlvLength;
    X509Instance = await X509Deployer.deploy();
    const ShieldInstance = await ShieldDeployer.deploy();
    await ShieldInstance.initialize();
    await ShieldInstance.enableWhitelisting(true);
    await ShieldInstance.createWhitelistManager(101, X509Instance.address);
    await X509Instance.initialize();
    await X509Instance.setWhitelistContractAddress(ShieldInstance.address);
    // await X509Instance.setWhitelistAddress(WhitelistInstance.address);
    derBuffer = fs.readFileSync('test/unit/utils/Nightfall_Intermediate_CA.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[1] = {
      derBuffer,
      tlvLength,
      authorityKeyIdentifier: `0x${'ef355558d6fdee0d5d02a22d078e057b74644e5f'.padStart(64, '0')}`,
    };
    derBuffer = fs.readFileSync('test/unit/utils/Nightfall_end_user.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[0] = { derBuffer, tlvLength };
    // sign the ethereum address
    const accounts = await ethers.getSigners();
    addressToSign = accounts[0].address;
    signature = signEthereumAddress(derPrivateKey, addressToSign);
  });
  it('Should parse the intermediate CA cert DER encoding', async function () {
    const intermediateCaCert = certChain[0];
    const result = await X509Instance.parseDER(
      intermediateCaCert.derBuffer,
      0,
      intermediateCaCert.tlvLength,
    );
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[intermediateCaCert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[intermediateCaCert.tlvLength - 1].depth).to.equal(1);
    // console.log(tlvs);
  });
  it('Should parse the end-user cert DER encoding', async function () {
    const endUserCert = certChain[1];
    const result = await X509Instance.parseDER(endUserCert.derBuffer, 0, endUserCert.tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[endUserCert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[endUserCert.tlvLength - 1].depth).to.equal(1);
    // console.log(tlvs);
  });
  it('Should verify the signature over the users ethereum address', async function () {
    const publicKey = crypto.createPublicKey({ key: derPrivateKey, format: 'der', type: 'pkcs1' });
    const isVerified = crypto.verify(
      'sha256',
      Buffer.from(addressToSign.toLowerCase().slice(2), 'hex'),
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      signature,
    );
    expect(isVerified).to.equal(true);
  });
  it('Should fail to validate the user certificate until it has validated the intermediate CA cert', async function () {
    // presenting the end user cert should fail because the smart contract doesn't have the intermediate CA cert
    try {
      await X509Instance.validateCertificate(
        certChain[0].derBuffer,
        certChain[0].tlvLength,
        signature,
        true,
      );
      expect.fail('The certificate check passed, but it should have failed');
    } catch (err) {
      expect(err.message.includes('VM Exception')).to.equal(true);
    }
    // a kyc check should also fail
    try {
      await X509Instance.kycCheck(addressToSign);
      expect.fail('The KYC check passed, but it should have failed');
    } catch (err) {
      expect(err.message.includes('VM Exception')).to.equal(true);
    }
    // presenting the Intermediate CA cert should work because the smart contact trusts the root public key
    await X509Instance.validateCertificate(
      certChain[1].derBuffer,
      certChain[1].tlvLength,
      0,
      false,
    );
    // now presenting the end user cert should work because the smart contract now trusts the Intermediate CA public key
    await X509Instance.validateCertificate(
      certChain[0].derBuffer,
      certChain[0].tlvLength,
      signature,
      true,
    );
    // we should now be able to pass a KYC check for this address
    await X509Instance.kycCheck(addressToSign);
  });
});
