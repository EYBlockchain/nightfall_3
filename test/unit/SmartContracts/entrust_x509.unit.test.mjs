/* eslint object-shorthand: off */

import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import config from 'config';
import { makeTlv } from '../utils/x509.mjs';

const { ethers } = hardhat;
const {
  X509: {
    blockchain: {
      extendedKeyUsageOIDs,
      certificatePoliciesOIDs,
      RSA_TRUST_ROOTS: [, { modulus, exponent, authorityKeyIdentifier }],
    },
  },
} = config;

function getCertAdder(X509Instance) {
  const certChain = [];
  return async certPath => {
    if (!certPath) return certChain;
    const derBuffer = fs.readFileSync(certPath);
    const tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain.push({ derBuffer, tlvLength, X509Instance });
    return certChain;
  };
}

async function parseCert(cert) {
  const result = await cert.X509Instance.parseDER(cert.derBuffer, 0, cert.tlvLength);
  const tlvs = result.map(tlv => makeTlv(tlv));
  // make a few checks on the output
  expect(tlvs[0].tag.tagType).to.equal('SEQUENCE');
  expect(tlvs[0].depth).to.equal(0);
  expect(tlvs[1].tag.tagType).to.equal('SEQUENCE');
  expect(tlvs[1].depth).to.equal(1);
  expect(tlvs[cert.tlvLength - 1].tag.tagType).to.equal('BIT_STRING');
  expect(tlvs[cert.tlvLength - 1].depth).to.equal(1);
}

async function validateCert(cert) {
  await cert.X509Instance.validateCertificate(cert.derBuffer, cert.tlvLength, 0, false, 0);
}

describe('Certificate parsing and chain validation functions', function () {
  let certChain;

  before(async () => {
    const X509Deployer = await ethers.getContractFactory('X509');
    const X509Instance = await X509Deployer.deploy();
    await X509Instance.initialize();
    const entrustRootPublicKey = { modulus, exponent };
    await X509Instance.setTrustedPublicKey(entrustRootPublicKey, authorityKeyIdentifier);
    await X509Instance.enableWhitelisting(true);
    await X509Instance.addExtendedKeyUsage(extendedKeyUsageOIDs[2]);
    await X509Instance.addCertificatePolicies(certificatePoliciesOIDs[2]);
    certChain = getCertAdder(X509Instance);
    // add certificates to the chain
    await certChain('test/unit/utils/entrust_intermediate2.crt');
    await certChain('test/unit/utils/entrust_intermediate1.crt');
    await certChain('test/unit/utils/entrust_end_user.crt');
  });

  it('Should parse the DER encoding of all of the certificates in the chain', async function () {
    // calling certChain with no argument just returns the certChain without adding anything
    await Promise.all((await certChain()).map(cert => parseCert(cert)));
  });

  it('Should validate the certificate chain', async function () {
    // these must be done in order because they rely one their parent being added to the trusted keys
    await validateCert((await certChain())[0]);
    await validateCert((await certChain())[1]);
    // await validateCert(certChain[2]);
  });
});
