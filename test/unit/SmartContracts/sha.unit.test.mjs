import { expect } from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

describe('SHA512 tests', function () {
  let ShaInstance;
  before(async () => {
    const ShaDeployer = await ethers.getContractFactory('Sha');
    ShaInstance = await ShaDeployer.deploy();
  });
  it('Should correctly compute all test vectors', async function () {
    const t1 = {
      in: '0x616263',
      out: '0xddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    };
    const r1 = await ShaInstance.sha512(t1.in);
    console.log(r1, (r1.length - 2) * 4);
  });
});
