import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';
import crypto from 'crypto';
import { makeTlv, signEthereumAddress } from '../utils/x509.mjs';

const { ethers } = hardhat;
const userCertPrefix = process.env.USER_CERT_PREFIX;

describe('DerParser contract functions', function () {
  const authorityKeyIdentifier = `0x${'11AD44C2BC7D4B7D50B68602C537236AC7BCDDCA'.padStart(
    64,
    '0',
  )}`;
  const nightfallRootPublicKey = {
    modulus:
      '0x97074292ED11A5E8D80E8D51B5061E64AEB9A889CD06CF0B1D2142FBC6E2C95351ABA62C4CE7BDAE59F566DC402D5883E4CFB39129244AAA97AEFEC834AE79CA4E2945D332D3C9A870E06BEFDC42DA8927B1274C04C08EE11A986AA2302113881665DE1DE2438D37476E3A97CA23197291CC0F60199476A2E827BAF4D902D3EFDB7C7EBBB672926CBA8E9AF990A19A3F64AA884F8B927CC9C6622794BA555F6472E2458E082D4FDE63C407A20F891B8FEC00F61F1DE8534ABE112CDEAEB929C1BC0A20EE5F1521077C3DFB7259E77C44C507FEACBC8CB405A64B3D951CE9513717A5E4606461A507CEF9F12A00435D7F41DDE219313E8F4CBFBC4A837380B064E5AFEC481609BCB18EE956B2A6E50D6A3FAE387467AD85A860B4311F4BDF1291D0A2DF1BB830318D70490D8471E0E752B088B1DB60D4C71F86963F70E22CD75BACA1909F7612D959A91ACF918C5D321F6D658504BE97CE38215B5E7B704570997F0F76BF4284D89E95055E5152C9FC896889F5BC4C621320A3007DA3DDF64106F13326B71A25818B10410B03B57AC588A66A1A9E71A9FA3AA10210207F257F00205BDF840C4F0FB93295DB6E41BCFDBB85959B112C202AF84084C2A6CFF85BEFDA3A9FFD5389078292D56D2C7D1336FFD3CC9A4F8A6D781D2122546C902C687B18F0C342457388E9773E6780B95A8123C90AF0EA157E113E58DCF0C93DC703B5',
    exponent: 65537,
  };
  let X509Instance;
  let signature;
  let addressToSign;
  const derPrivateKey = fs.readFileSync(`/home/israel/work/nightfall_3_private/deployment/test/_certificates/${userCertPrefix}.pass.priv_key`);
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

    derBuffer = fs.readFileSync(`/home/israel/work/nightfall_3_private/deployment/test/_certificates/${userCertPrefix}.crt`);
    tlvLength = await X509Instance.computeNumberOfTlvs(derBuffer, 0);
    certChain[0] = { derBuffer, tlvLength };

    // sign the ethereum address
    signature = signEthereumAddress(derPrivateKey, addressToSign);
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

  it('Should validate the user certificate', async function () {
    // presenting the end user cert should fail because the smart contract doesn't have the intermediate CA cert
    await X509Instance.validateCertificate(
      certChain[0].derBuffer,
      certChain[0].tlvLength,
      signature,
      true,
    );
    
    // an x509 check should also fail
    let result = await X509Instance.x509Check(addressToSign);
    expect(result).to.equal(true);
  });
});
