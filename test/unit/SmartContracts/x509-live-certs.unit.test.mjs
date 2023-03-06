/* eslint-disable no-await-in-loop */
/* eslint object-shorthand: off */

import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import path from 'path';
import config from 'config';
import { makeTlv } from '../utils/x509.mjs';

const { ethers } = hardhat;

const loadCert = async (filename, X509Instance) => {
  const derBuffer = await fs.promises.readFile(filename);
  const tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
  return { derBuffer, tlvLength };
};

const checkTlvs = (result, tlvLength) => {
  const tlvs = result.map(tlv => makeTlv(tlv));
  expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
  expect(tlvs[0].depth).to.equal(0);
  expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
  expect(tlvs[1].depth).to.equal(1);
  expect(tlvs[tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
  expect(tlvs[tlvLength - 1].depth).to.equal(1);
};

// function to extract the files from a directory and its subdirectories
const extractFiles = directory => {
  const fileArray = [];
  // Get the list of files in the directory and store it in a variable
  const files = fs.readdirSync(directory);
  // Loop through each file in the directory
  for (let i = 0; i < files.length; i++) {
    // Create a path variable to store the full path of each file
    const dir = path.join(directory, files[i]);
    // Check if the file is a directory or not
    if (fs.statSync(dir).isDirectory()) {
      // If it is a directory, call this function again with the new path as an argument to get all the files in that subdirectory as well
      extractFiles(dir);
    } else {
      // If it is not a directory, add it to our array of files.
      fileArray.push(dir);
    }
  }
  return fileArray;
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

  it('Should read and correctly parse all of the live certificates', async function () {
    const fileArray = extractFiles('test/unit/utils/live_certs/');
    for (const file of fileArray) {
      const { derBuffer, tlvLength } = await loadCert(file, X509Instance);
      const tlvs = await X509Instance.parseDER(derBuffer, 0, tlvLength);
      checkTlvs(tlvs, tlvLength);
    }
  });

  it('Should validate end-user certs only when the cert chain is in place', async function () {
    const dir = 'test/unit/utils/live_certs/';
    const endUserCerts = [
      'entrust/entrust_code_signer.crt',
      'entrust/entrust_document_signer.crt',
      'ey/EYblockchain_end_user.crt',
    ];
    const intermediateCaCerts = [
      ['entrust/Intermediate2.crt', 'entrust/Intermediate1.crt'],
      ['entrust/class3-2048.crt'],
      ['ey/EYBlockchain_intermediate.crt'],
    ];
    // presenting the end user cert should fail because the smart contract doesn't have the intermediate CA cert
    // we use the checkOnly flag because we don't have a private key to sign with (so the signature is set to null).
    for (const cert of endUserCerts) {
      const { derBuffer, tlvLength } = await loadCert(path.join(dir, cert), X509Instance);
      try {
        await X509Instance.validateCertificate(derBuffer, tlvLength, 0, true, true, 0);
        expect.fail('The certificate check passed, but it should have failed');
      } catch (err) {
        expect(err.message.includes('VM Exception')).to.equal(true);
      }
    }
    // now load the intermediate CA certificates, in order, for each end user certificate
    for (const cert of intermediateCaCerts.flat(1)) {
      const { derBuffer, tlvLength } = await loadCert(path.join(dir, cert), X509Instance);
      await X509Instance.validateCertificate(derBuffer, tlvLength, 0, false, false, 0);
    }
    // now loading the end user certs should work fine (we can't test the whitelisting because we have no private key)
    for (let i = 0; i < endUserCerts.length; i++) {
      const { derBuffer, tlvLength } = await loadCert(
        path.join(dir, endUserCerts[i]),
        X509Instance,
      );
      await X509Instance.validateCertificate(derBuffer, tlvLength, 0, true, true, i);
    }
  });
});
