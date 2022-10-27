import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';

import makeTlv from '../utils/tlv.mjs';

const { ethers } = hardhat;
const { BigNumber } = ethers;

describe('DerParser contract functions', function () {
  const authorityKeyIdentifier = `0x${'3016801479B459E67BB6E5E40173800888C81A58F6E99B6E'.padStart(
    64,
    '0',
  )}`;
  const modulus =
    '0x00ade82473f41437f39b9e2b57281c87bedcb7df38908c6e3ce657a078f775c2a2fef56a6ef6004f28dbde68866c4493b6b163fd14126bbf1fd2ea319b217ed1333cba48f5dd79dfb3b8ff12f1219a4bc18a8671694a66666c8f7e3c70bfad292206f3e4c0e680aee24b8fb7997e94039fd347977c99482353e838ae4f0a6f832ed149578c8074b6da2fd0388d7b0370211b75f2303cfa8faeddda63abeb164fc28e114b7ecf0be8ffb5772ef4b27b4ae04c12250c708d0329a0e15324ec13d9ee19bf10b34a8c3f89a36151deac870794f46371ec2ee26f5b9881e1895c34796c76ef3b906279e6dba49a2f26c5d010e10eded9108e16fbb7f7a8f7c7e50207988f360895e7e237960d36759efb0e72b11d9bbc03f94905d881dd05b42ad641e9ac0176950a0fd8dfd5bd121f352f28176cd298c1a80964776e4737baceac595e689d7f72d689c50641293e593edd26f524c911a75aa34c401f46a199b5a73a516e863b9e7d72a712057859ed3e5178150b038f8dd02f05b23e7b4a1c4b730512fcc6eae050137c439374b3ca74e78e1f0108d030d45b7136b407bac130305c48b7823b98a67d608aa2a32982ccbabd83041ba2830341a1d605f11bc2b6f0a87c863b46a8482a88dc769a76bf1f6aa53d198feb38f364dec82b0d0a28fff7dbe21542d422d0275de179fe18e77088ad4ee6d98b3ac6dd27516effbc64f533434f';
  const exponent = 65537;
  let derBuffer;
  let X509Instance;
  before(async () => {
    derBuffer = fs.readFileSync('test/unit/utils/root.der');
    const X509Deployer = await ethers.getContractFactory('X509');
    X509Instance = await X509Deployer.deploy();
    await X509Instance.initialize();
    await X509Instance.setTrustedPublicKey({ modulus, exponent }, authorityKeyIdentifier);
  });
  it('Should parse the root cert der file', async function () {
    const result = await X509Instance.parseDER(derBuffer, 0);
    const [tlvs, id] = [result[0].map(tlv => makeTlv(tlv)), result[1]];
    // console.log(tlvs.slice(0, id));
  });
  it('Should store some state', async function () {
    await X509Instance.store(derBuffer);
  });
  it('Should test the modular exponentiation', async function () {
    const res = await X509Instance.testModExp(
      '0x03',
      BigNumber.from('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2e'),
      '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
    );
    expect(res).to.equal('0x0000000000000000000000000000000000000000000000000000000000000001');
  });
  it('Should validate the certificate', async function () {
    await X509Instance.validateCertificate(derBuffer, authorityKeyIdentifier)
    console.log(await X509Instance.isValid());
    // const tlvs = (await X509Instance.validateCertificate(derBuffer, authorityKeyIdentifier)).map(
    //   tlv => makeTlv(tlv),
    // );
    // console.log('***TLV***', tlvs);
  });
});
