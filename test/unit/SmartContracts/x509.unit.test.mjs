import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import crypto from 'crypto';
import config from 'config';
import { makeTlv, signEthereumAddress } from '../utils/x509.mjs';

const { ethers } = hardhat;
const {
  X509: {
    blockchain: {
      extendedKeyUsageOIDs,
      certificatePoliciesOIDs,
      RSA_TRUST_ROOTS: [{ modulus, exponent }],
    },
  },
} = config;

const AUTHORITY_KEY_IDENTIFIER = process.env.AUTHORITY_KEY_IDENTIFIER || `0x${'ef355558d6fdee0d5d02a22d078e057b74644e5f'.padStart(64, '0',)}`;
const MODULUS = process.env.MODULUS || '0x00c6cdaeb44c7b8fe697a3b8a269799176078ae3cb065010f55a1f1a839ff203b1e785d6782eb9c04e0e1cf63ec7ef21c6d3201c818647b8cea476112463caa8339f03e678212f0214c4a50de21cabc8001ef269eef4930fcd1dd2911ba40d505fcee5508bd91a79aadc70cc33c77be14908b1c32f880a8bb8e2d863838cfa6bd444c47dd30f78650caf1dd947adcf48b427536d294240d40335eaee5db31399b04b3893936cc41c04602b713603526a1e003112bf213e6f5a99830fa821783340c46597e481e1ee4c0c6b3aca32628b70886a396d737537bcfae5ba51dfd6add1728aa6bde5aeb8c27289fb8e911569a41c3e3f48b9b2671c673faac7f085a195';
const END_USER_PRIV_KEY_PATH = process.env.END_USER_PRIV_KEY_PATH || 'test/unit/utils/Nightfall_end_user_policies.der';
const END_USER_CERTIFICATE_PATH = process.env.END_USER_CERTIFICATE_PATH || 'test/unit/utils/Nightfall_end_user_policies.cer';
const SKIP_INTERMEDIATE_CERTS_TEST = process.env.SKIP_INTERMEDIATE_CERTS_TEST;

console.log(AUTHORITY_KEY_IDENTIFIER, MODULUS, END_USER_PRIV_KEY_PATH, END_USER_CERTIFICATE_PATH);

describe('DerParser contract functions', function () {
  const authorityKeyIdentifier = AUTHORITY_KEY_IDENTIFIER;
  const nightfallRootPublicKey = {
    modulus: MODULUS,
    exponent: 65537,
  };

  let X509Instance;
  let signature;
  let digicertSignature;
  let entrustSignature;
  let addressToSign;

  const derPrivateKey = fs.readFileSync(END_USER_PRIV_KEY_PATH);
  const digicertPrivateKey = fs.readFileSync('test/unit/utils/digicert_document_signing_mock.der');
  const entrustPrivateKey = fs.readFileSync('test/unit/utils/entrust_document_signing_mock.der');
  const certChain = []; // contains the certificate to verify chain, lowest index is lowest cert in chain (i.e. [0] = end user)
  let digicertMock;
  let entrustMock;

  before(async () => {
    const accounts = await ethers.getSigners();
    addressToSign = accounts[0].address;
    const X509Deployer = await ethers.getContractFactory('X509');
    let derBuffer;
    let tlvLength;

    X509Instance = await X509Deployer.deploy();

    await X509Instance.initialize();
    await X509Instance.setTrustedPublicKey(nightfallRootPublicKey, authorityKeyIdentifier);
    await X509Instance.enableWhitelisting(true);

    // made up values
    await X509Instance.addExtendedKeyUsage(extendedKeyUsageOIDs[0]);
    await X509Instance.addCertificatePolicies(certificatePoliciesOIDs[0]);
    // digicert mock
    await X509Instance.addExtendedKeyUsage(extendedKeyUsageOIDs[1]);
    await X509Instance.addCertificatePolicies(certificatePoliciesOIDs[1]);
    // entrust mock
    await X509Instance.addExtendedKeyUsage(extendedKeyUsageOIDs[2]);
    await X509Instance.addCertificatePolicies(certificatePoliciesOIDs[2]);

    derBuffer = fs.readFileSync('test/unit/utils/Nightfall_Intermediate_CA.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[1] = {
      derBuffer,
      tlvLength,
      authorityKeyIdentifier: AUTHORITY_KEY_IDENTIFIER,
    };

    derBuffer = fs.readFileSync(END_USER_CERTIFICATE_PATH);
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[0] = { derBuffer, tlvLength };

    // sign the ethereum address
    signature = signEthereumAddress(derPrivateKey, addressToSign);
    derBuffer = fs.readFileSync('test/unit/utils/digicert_document_signing_mock.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    digicertMock = { derBuffer, tlvLength };

    digicertSignature = signEthereumAddress(digicertPrivateKey, addressToSign);
    derBuffer = fs.readFileSync('test/unit/utils/entrust_document_signing_mock.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    entrustMock = { derBuffer, tlvLength };

    entrustSignature = signEthereumAddress(entrustPrivateKey, addressToSign);
  });

  it('Should parse the intermediate CA cert DER encoding', async function () {
    const intermediateCaCert = certChain[1];
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
  });

  it('Should parse the end-user cert DER encoding', async function () {
    const endUserCert = certChain[0];
    const result = await X509Instance.parseDER(endUserCert.derBuffer, 0, endUserCert.tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[endUserCert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[endUserCert.tlvLength - 1].depth).to.equal(1);
  });

  it('Should parse the end-user mock Digicert cert DER encoding', async function () {
    const endUserCert = digicertMock;
    const result = await X509Instance.parseDER(endUserCert.derBuffer, 0, endUserCert.tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[endUserCert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[endUserCert.tlvLength - 1].depth).to.equal(1);
  });

  it('Should parse the end-user mock Entrust cert DER encoding', async function () {
    const endUserCert = entrustMock;
    const result = await X509Instance.parseDER(endUserCert.derBuffer, 0, endUserCert.tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[endUserCert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[endUserCert.tlvLength - 1].depth).to.equal(1);
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
    let result;
    if (! SKIP_INTERMEDIATE_CERTS_TEST) {
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

      // an x509 check should also fail
      result = await X509Instance.x509Check(addressToSign);
      expect(result).to.equal(false);

      // presenting the Intermediate CA cert should work because the smart contact trusts the root public key
      await X509Instance.validateCertificate(
        certChain[0].derBuffer,
        certChain[0].tlvLength,
        signature,
        true,
        0,
      );
    }

    // an x509 check should also fail
    result = await X509Instance.x509Check(addressToSign);
    expect(result).to.equal(false);
    // presenting the Intermediate CA cert should work because the smart contact trusts the root public key
    await X509Instance.validateCertificate(
      certChain[1].derBuffer,
      certChain[1].tlvLength,
      0,
      false,
      0,
    );

    // now presenting the end user cert should also work
    await X509Instance.validateCertificate(
      certChain[0].derBuffer,
      certChain[0].tlvLength,
      signature,
      true,
      0,
    );

    // we should now be able to pass an x509 check for this address
    result = await X509Instance.x509Check(addressToSign);
    expect(result).to.equal(true);

    // now presenting the Digicert mock cert should also work
    await X509Instance.validateCertificate(
      digicertMock.derBuffer,
      digicertMock.tlvLength,
      digicertSignature,
      true,
      1,
    );

    // now presenting the Digicert mock cert should also work
    await X509Instance.validateCertificate(
      entrustMock.derBuffer,
      entrustMock.tlvLength,
      entrustSignature,
      true,
      2,
    );
  });
});
