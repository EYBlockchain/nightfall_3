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
  before(async () => {
    const ShaDeployer = await ethers.getContractFactory('Sha');
    ShaInstance = await ShaDeployer.deploy();
    const nistVectorsShort = readNistVectors(
      'test/unit/utils/nist_test_vectors/SHA512ShortMsg.rsp',
    );
    const nistVectorsLong = readNistVectors('test/unit/utils/nist_test_vectors/SHA512LongMsg.rsp');
    nistVectors = [...nistVectorsShort, ...nistVectorsLong];
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
