import { expect } from 'chai';
import hardhat from 'hardhat';
import fs from 'fs';

const { ethers } = hardhat;

function readNistVectors(filename) {
  const payload = line => line.split('=')[1].trim();
  const file = fs.readFileSync(filename);
  const lines = file.toString().split('\n');
  const nistVectors = [];
  let len;
  let msg;
  let md;
  for (const line of lines) {
    if (line.includes('#')) continue; // eslint-disable-line no-continue
    if (line.includes('Len')) len = parseInt(payload(line), 10);
    else if (line.includes('Msg')) msg = `0x${payload(line)}`;
    else if (line.includes('MD')) {
      // if we get here, we've seen all three lines that make up a test vector, so process the last line and store the vector
      md = `0x${payload(line)}`;
      if (len !== 0) nistVectors.push({ len, msg, md });
    }
    if (len >= 32768) break; // anything longer than this takes ages to comput and it's bigger than a cert is likely to be
  }
  return nistVectors;
}

describe('SHA512 tests', function () {
  let ShaInstance;
  let nistVectors;
  const message448 =
    '0x6162636462636465636465666465666765666768666768696768696a68696a6b696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f6d6e6f706e6f7071';
  before(async () => {
    const ShaDeployer = await ethers.getContractFactory('Sha');
    ShaInstance = await ShaDeployer.deploy();
    const nistVectorsShort = readNistVectors(
      'test/unit/utils/nist_test_vectors/SHA512ShortMsg.rsp',
    );
    const nistVectorsLong = readNistVectors('test/unit/utils/nist_test_vectors/SHA512LongMsg.rsp');
    nistVectors = [...nistVectorsShort, ...nistVectorsLong];
  });
  it('Should correctly shift right', async function () {
    const t1 = {
      in: '0x000000000000000000000000000000000000000000000000ffffffffffffffff',
      out: '0x0000000000000000000000000000000000000000000000007fffffffffffffff',
    };
    const t2 = {
      in: '0x0000000000000000000000000000000000000000000000000000000000000003',
      out: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    const rs1 = (await ShaInstance.SHR(1, t1.in)).mask(64);
    expect(rs1).to.be.equal(t1.out);
    const rs2 = (await ShaInstance.SHR(2, t2.in)).mask(64);
    expect(rs2).to.be.equal(t2.out);
  });
  it('Should correctly rotate right', async function () {
    const t1 = {
      in: '0x0000000000000000000000000000000000000000000000000000000000000003',
      out: '0x0000000000000000000000000000000000000000000000008000000000000001',
    };
    const t2 = {
      in: '0x0000000000000000000000000000000000000000000000007fffffffffffffff',
      out: '0x000000000000000000000000000000000000000000000000bfffffffffffffff',
    };
    const t3 = {
      in: '0x0000000000000000000000000000000000000000000000000000000000000003',
      out: '0x000000000000000000000000000000000000000000000000c000000000000000',
    };
    const rs1 = (await ShaInstance.ROTR(1, t1.in)).mask(64);
    expect(rs1).to.be.equal(t1.out);
    const rs2 = (await ShaInstance.ROTR(1, t2.in)).mask(64);
    expect(rs2).to.be.equal(t2.out);
    const rs3 = (await ShaInstance.ROTR(2, t3.in)).mask(64);
    expect(rs3).to.be.equal(t3.out);
  });
  it('Should correctly pad the message', async function () {
    const paddedMessage = await ShaInstance.padMessage1024(message448);
    expect(paddedMessage.length).to.be.equal(128 * 2 + 2); // 128 bytes (1024 bits)
    expect(message448.concat('80')).to.be.equal(paddedMessage.slice(0, message448.length + 2));
    expect(BigInt(`0x${paddedMessage.slice(-32)}`)).to.be.equal(448n);
  });
  it('Should correctly parse a padded message into message blocks', async function () {
    const paddedMessage = await ShaInstance.padMessage1024(message448); // bytes resolves to a hex string
    const parsedMessage = await ShaInstance.parseMessage1024(paddedMessage); // bytes resolves to a hex string
    expect(parsedMessage[0]).to.be.equal(paddedMessage); // the padded message is only one block long
    expect(parsedMessage.length).to.be.equal(1);
  });
  it('Should correctly separate a message block into words', async function () {
    const paddedMessage = await ShaInstance.padMessage1024(message448);
    const parsedMessage = await ShaInstance.parseMessage1024(paddedMessage);
    const words = await ShaInstance.parseMessageBlock1024(parsedMessage[0]);
    const tests = words.map(w => w.toHexString().slice(2).padStart(16, '0')); // remove the 0x
    let test = '';
    for (let i = 0; i < tests.length; i++) {
      test = test.concat(tests[i]);
    }
    test = `0x${test}`;
    expect(words.length).to.be.equal(16);
    expect(paddedMessage).to.be.equal(test); // if we reassemble the words, do we get the same answer?
  });
  it('Should correctly compute the NIST test vectors < 32kb in size', async function () {
    // collect results asynchronously as this is a long test
    const checkResult = async test => {
      expect(await test.result).to.be.equal(
        test.vector.md,
        `Test failed for input ${test.vector.msg}, of length ${test.vector.len}`,
      );
    };
    const nistResults = [];
    for (const vector of nistVectors) {
      const result = ShaInstance.sha512(vector.msg);
      nistResults.push(checkResult({ result, vector }));
    }
    await Promise.all(nistResults);
  });
});
