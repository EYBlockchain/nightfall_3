import { expect } from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

describe('SHA512 tests', function () {
  let ShaInstance;
  before(async () => {
    const ShaDeployer = await ethers.getContractFactory('Sha');
    ShaInstance = await ShaDeployer.deploy();
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
  it('Should correctly compute all test vectors', async function () {
    const t1 = {
      in: '0x616263',
      out: '0xddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
      out256: '0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    };
    const check = await ShaInstance._sha256(t1.in);
    expect(check).to.equal(t1.out256);
    const r1 = await ShaInstance.sha512(t1.in);
    expect(r1).to.equal(t1.out);
  });
});
