/* eslint object-shorthand: off */

import { expect } from 'chai';
import hardhat from 'hardhat';
import { readFile } from 'node:fs/promises';
import config from 'config';
import { makeTlv } from '../utils/x509.mjs';

const { ethers } = hardhat;

const loadCert = async (filename, X509Instance) => {
  const derBuffer = await readFile(filename);
  const tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
  return { derBuffer, tlvLength };
};

const {
  X509: {
    live: { extendedKeyUsageOIDs, certificatePoliciesOIDs, RSA_TRUST_ROOTS },
  },
} = config;

describe('DerParser contract functions', function () {
  let X509Instance;

  before(async () => {
    const beforePromises = [];
    const X509Deployer = await ethers.getContractFactory('X509');
    X509Instance = await X509Deployer.deploy();
    await X509Instance.initialize();
    // load in the trust roots
    for (const rsaTrustRoot of RSA_TRUST_ROOTS) {
      beforePromises.push(
        X509Instance.setTrustedPublicKey(
          { modulus: rsaTrustRoot.modulus, exponent: rsaTrustRoot.exponent },
          rsaTrustRoot.authorityKeyIdentifier,
        ),
      );
    }
    beforePromises.push(X509Instance.enableWhitelisting(true));
    // load in the extended key usages
    for (const extendedKeyUsageOIDsGroup of extendedKeyUsageOIDs) {
      beforePromises.push(X509Instance.addExtendedKeyUsage(extendedKeyUsageOIDsGroup));
    }
    // and the policy oids
    for (const certificatePoliciesOIDsGroup of certificatePoliciesOIDs) {
      beforePromises.push(X509Instance.addCertificatePolicies(certificatePoliciesOIDsGroup));
    }
    await Promise.all(beforePromises); // wait until the chain is updated
  });

  it('Should parse the senior Entrust intermediate CA cert DER encoding', async function () {
    const { derBuffer, tlvLength } = await loadCert(
      'test/unit/utils/live_certs/Intermediate2.crt',
      X509Instance,
    );
    const result = await X509Instance.parseDER(derBuffer, 0, tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[tlvLength - 1].depth).to.equal(1);
  });

  it('Should parse the junior Entrust intermediate CA cert DER encoding', async function () {
    const { derBuffer, tlvLength } = await loadCert(
      'test/unit/utils/live_certs/Intermediate1.crt',
      X509Instance,
    );
    const result = await X509Instance.parseDER(derBuffer, 0, tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[tlvLength - 1].depth).to.equal(1);
  });
  it('Should parse the Entrust code signing EV cert cert DER encoding', async function () {
    const { derBuffer, tlvLength } = await loadCert(
      'test/unit/utils/live_certs/entrust_code_signer.crt',
      X509Instance,
    );
    const result = await X509Instance.parseDER(derBuffer, 0, tlvLength);
    const tlvs = result.map(tlv => makeTlv(tlv));
    // make a few checks on the output
    expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[0].depth).to.equal(0);
    expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
    expect(tlvs[1].depth).to.equal(1);
    expect(tlvs[tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
    expect(tlvs[tlvLength - 1].depth).to.equal(1);
  });

  it('Should fail to validate the Entrust EV Code Signing certificate until it has validated the intermediate CA certs', async function () {
    const entrustEVCodeSigningCert = await loadCert(
      'test/unit/utils/live_certs/entrust_code_signer.crt',
      X509Instance,
    );
    // presenting the end user cert should fail because the smart contract doesn't have the intermediate CA cert
    // we use the checkOnly flag because we don't have a private key to sign with (so the signature is set to null).
    try {
      await X509Instance.validateCertificate(
        entrustEVCodeSigningCert.derBuffer,
        entrustEVCodeSigningCert.tlvLength,
        0,
        true,
        true,
        0,
      );
      expect.fail('The certificate check passed, but it should have failed');
    } catch (err) {
      expect(err.message.includes('VM Exception')).to.equal(true);
    }

    // an x509 check should also fail
    const accounts = await ethers.getSigners();
    const addressToSign = accounts[0].address;
    const result = await X509Instance.x509Check(addressToSign);
    expect(result).to.equal(false);

    // presenting the senior Entrust Intermediate CA cert should work because the smart contact trusts the root public key
    const entrustSeniorIntermediateCaCert = await loadCert(
      'test/unit/utils/live_certs/Intermediate2.crt',
      X509Instance,
    );
    await X509Instance.validateCertificate(
      entrustSeniorIntermediateCaCert.derBuffer,
      entrustSeniorIntermediateCaCert.tlvLength,
      0,
      false,
      false,
      0,
    );

    // now presenting the junior Entrust Intermediate CA cert should also work
    const entrustJuniorIntermediateCaCert = await loadCert(
      'test/unit/utils/live_certs/Intermediate1.crt',
      X509Instance,
    );
    await X509Instance.validateCertificate(
      entrustJuniorIntermediateCaCert.derBuffer,
      entrustJuniorIntermediateCaCert.tlvLength,
      0,
      false,
      false,
      0,
    );

    // now presenting the junior Entrust Intermediate CA cert should also work (we're only checking the cert here
    // not actually whitelisting an address because we don't have a private key that goes with the cert)
    await X509Instance.validateCertificate(
      entrustEVCodeSigningCert.derBuffer,
      entrustEVCodeSigningCert.tlvLength,
      0,
      true,
      true,
      0,
    );
  });
});
