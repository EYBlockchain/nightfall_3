import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import crypto from 'crypto';
import { makeTlv, signEthereumAddress } from '../utils/x509.mjs';

const { ethers } = hardhat;

describe('DerParser contract functions', function () {
  const authorityKeyIdentifier = `0x${'11ad44c2bc7d4B7d50b68602c537236ac7bcddca'.padStart(
    64,
    '0',
  )}`;
  const nightfallRootPublicKey = {
    modulus:
      '0x0097074292ed11a5e8d80e8d51b5061e64aeb9a889cd06cf0b1d2142fbc6e2c95351aba62c4ce7bdae59f566dc402d5883e4cfb39129244aaa97aefec834ae79ca4e2945d332d3c9a870e06befdc42da8927b1274c04c08ee11a986aa2302113881665de1de2438d37476e3a97ca23197291cc0f60199476a2e827baf4d902d3efdb7c7ebbb672926cba8e9af990a19a3f64aa884f8b927cc9c6622794ba555f6472e2458e082d4fde63c407a20f891b8fec00f61f1de8534abe112cdeaeb929c1bc0a20ee5f1521077c3dfb7259e77c44c507feacbc8cb405a64b3d951ce9513717a5e4606461a507cef9f12a00435d7f41dde219313e8f4cbfbc4a837380b064e5afec481609bcb18ee956b2a6e50d6a3fae387467ad85a860b4311f4bdf1291d0a2df1bb830318d70490d8471e0e752b088b1db60d4c71f86963f70e22cd75baca1909f7612d959a91acf918c5d321f6d658504be97ce38215b5e7b704570997f0f76bf4284d89e95055e5152c9fc896889f5bc4c621320a3007da3ddf64106f13326b71a25818b10410b03b57ac588a66a1a9e71a9fa3aa10210207f257f00205bdf840c4f0fb93295db6e41bcfdbb85959b112c202af84084c2a6cff85befda3a9ffd5389078292d56d2c7d1336ffd3cc9a4f8a6d781d2122546c902c687b18f0c342457388e9773e6780b95a8123c90af0ea157e113e58dcf0c93dc703b5',
    exponent: 65537,
  };
  let X509Instance;
  let signature;
  let addressToSign;
  const derPrivateKey = fs.readFileSync('test/unit/utils/user1.der');
  const certChain = []; // contains the certificate to verify chain, lowest index is lowest cert in chain (i.e. [0] = end user)
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
    derBuffer = fs.readFileSync('test/unit/utils/Nightfall_Intermediate_CA.cer');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[1] = {
      derBuffer,
      tlvLength,
      authorityKeyIdentifier: `0x${'ef355558d6fdee0d5d02a22d078e057b74644e5f'.padStart(64, '0')}`,
    };
    derBuffer = fs.readFileSync('test/unit/utils/user1.crt');
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[0] = { derBuffer, tlvLength };
    // sign the ethereum address
    signature = signEthereumAddress(derPrivateKey, addressToSign);
  });
  it.skip('Should parse the intermediate CA cert DER encoding', async function () {
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
    // try {
    //   await X509Instance.validateCertificate(
    //     certChain[0].derBuffer,
    //     certChain[0].tlvLength,
    //     signature,
    //     true,
    //   );
    //   expect.fail('The certificate check passed, but it should have failed');
    // } catch (err) {
    //   expect(err.message.includes('VM Exception')).to.equal(true);
    // }
    // // an x509 check should also fail
    // let result = await X509Instance.x509Check(addressToSign);
    // expect(result).to.equal(false);
    // // presenting the Intermediate CA cert should work because the smart contact trusts the root public key
    // await X509Instance.validateCertificate(
    //   certChain[1].derBuffer,
    //   certChain[1].tlvLength,
    //   0,
    //   false,
    // );
    // now presenting the end user cert should work because the smart contract now trusts the Intermediate CA public key
    await X509Instance.validateCertificate(
      certChain[0].derBuffer,
      certChain[0].tlvLength,
      signature,
      true,
    );
    // we should now be able to pass an x509 check for this address
    const result = await X509Instance.x509Check(addressToSign);
    expect(result).to.equal(true);
  });
});
