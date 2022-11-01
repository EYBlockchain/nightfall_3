// import chai from 'chai';
import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test deposit circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, '../../nightfall-deployer/circuits/deposit.circom');
  let circuit;

  let value;
  let fee;
  const transactionType = '0';
  let tokenType;
  let ercAddress;
  let historicRootBlockNumberL2;
  let tokenId;
  let recipientAddress;
  let commitments;
  let nullifiers;
  let compressedSecrets;
  let roots;
  let feeAddress;
  let commitmentsSalts;
  let commitmentsValues;
  let recipientPublicKey;

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    value = '10';
    fee = '0';
    tokenType = '2';
    tokenId = ['0', '0', '0', '0', '0', '0', '0', '0'];
    historicRootBlockNumberL2 = [];
    ercAddress = '1244582950436963187026995103809517175198080414757';
    commitments = ['14627067491386527497203135478731512230306131983561128029773817888478846134461'];
    nullifiers = [];
    compressedSecrets = ['0', '0'];
    roots = [];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    recipientAddress = '0';
    commitmentsValues = ['10'];
    commitmentsSalts = [
      '6499068262363583824685533150998011802289741882047025453802730658767842291316',
    ];
    recipientPublicKey = [
      [
        '8490685904787475746369366901729727151930997402058548597274067437080179631982',
        '16019898780588040648157153023567746553375452631966740349901590026272037097498',
      ],
    ];
  });

  it('Should verify a valid deposit', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    const w = await circuit.calculateWitness(input);
    await circuit.assertOut(w, {});
  });

  it('Should fail if compressed secrets is not zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets: [
        '0',
        '17999105792329651812725678444463795258152753649215938181082241399954600642554',
      ],
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if ercAddress is zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress: 0,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is 1 and value is different than zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType: 1,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is different than 1 and value is zero', async () => {
    const input = {
      value: 0,
      fee,
      transactionType,
      tokenType: 2,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is 0 and tokenId is different than zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType: 0,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId: ['0', '0', '0', '0', '0', '0', '0', '1'],
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if recipient address is not zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress: '893705366084700132548040460931008653290460453987',
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if first commitment is zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments: ['0'],
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if value sum does not hold', async () => {
    const input = {
      value: '25',
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if verify commitments fail', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      commitmentsValues,
      commitmentsSalts: ['1'],
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
