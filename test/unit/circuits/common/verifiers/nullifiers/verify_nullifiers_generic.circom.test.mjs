import chai from 'chai';
import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
const { expect } = chai;

describe('Test verify nullifiers generic', async function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'verify_nullifiers_generic_tester.circom');
  let circuit;

  let feeAddress;
  let packedErcAddress;
  let idRemainder;
  let nullifierKey;
  let zkpPublicKey;
  let nullifiersHashes;
  let nullifiersHashesFee;
  let rootsFee;
  let roots;
  let oldCommitmentValues;
  let oldCommitmentSalts;
  let paths;
  let orders;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../../../nightfall-deployer/circuits/common/verifiers/nullifiers/verify_nullifiers_generic.circom";
            component main = VerifyNullifiersGeneric(1);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    feeAddress = 1125360528328802728845025824341538569231269095278n;
    packedErcAddress = 1319533947831612348694315757168650042041713553662n;
    idRemainder = 0n;
    nullifierKey = 2787930237336587100082278872894775204779579143121290092412627049109578277791n;
    zkpPublicKey = [
      8490685904787475746369366901729727151930997402058548597274067437080179631982n,
      16019898780588040648157153023567746553375452631966740349901590026272037097498n,
    ];
    nullifiersHashes = [
      2207724361187662494692877390505503683367622541118926316891828393560377414898n,
    ];
    nullifiersHashesFee = [
      18931657905972874022577802160042815745194830474572094067897179186087906985783n,
    ];
    roots = [8535830982580873324102152099762196200612343389386448806089755383816302591333n];
    rootsFee = [16289539648271084520363059138612791218042772090169159821180486414071093028981n];
    oldCommitmentValues = [9n];
    oldCommitmentSalts = [
      7405834819373473390398805607598307550684000293621533253485716398271469554050n,
    ];
    paths = [
      [
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        11504083647475613610762929994264535144260144850390234901824637092424344449545n,
        0n,
        0n,
      ],
    ];
    orders = 4n;
  });

  after(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should verify a valid nullifier', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes,
      roots,
      oldCommitmentValues,
      oldCommitmentSalts,
      paths,
      orders,
      feeAddress,
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should verify a valid fee nullifier', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes: nullifiersHashesFee,
      roots: rootsFee,
      oldCommitmentValues,
      oldCommitmentSalts,
      paths,
      orders,
      feeAddress,
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });
  it('Should verify a valid nullifier whose value is zero', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes: [0n],
      roots: [0n],
      oldCommitmentValues: [0n],
      oldCommitmentSalts: [0n],
      paths: [
        [
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
          0n,
        ],
      ],
      orders: [0n],
      feeAddress,
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it("Should throw an error if a nullifier can't be reconstructed", async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes,
      roots,
      oldCommitmentValues,
      oldCommitmentSalts: [0n],
      paths,
      orders,
      feeAddress,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should throw an error if the root can not be reconstructed', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes,
      roots,
      oldCommitmentValues,
      oldCommitmentSalts,
      paths,
      orders: [1n],
      feeAddress,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it("Should throw an error if a nullifier fee can't be reconstructed", async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes: nullifiersHashesFee,
      roots: rootsFee,
      oldCommitmentValues,
      oldCommitmentSalts: [0n],
      paths,
      orders,
      feeAddress,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should throw an error if the root for a fee nullifier can not be reconstructed', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes: nullifiersHashesFee,
      roots: rootsFee,
      oldCommitmentValues,
      oldCommitmentSalts,
      paths,
      orders: [1n],
      feeAddress,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it("Should throw an error if hash is zero but value isn't", async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      nullifierKey,
      zkpPublicKey,
      nullifiersHashes: [0n],
      roots,
      oldCommitmentValues,
      oldCommitmentSalts,
      paths,
      orders,
      feeAddress,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
