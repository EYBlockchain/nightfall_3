import chai from 'chai';
import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
const { expect } = chai;

describe('Test verify nullifiers', async function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'verify_nullifiers_tester.circom');
  let circuit;

  let packedErcAddress;
  let idRemainder;
  let nullifierKey;
  let zkpPublicKey;
  let nullifiersHashes;
  let roots;
  let oldCommitmentValues;
  let oldCommitmentSalts;
  let paths;
  let orders;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../../../nightfall-deployer/circuits/common/verifiers/nullifiers/verify_nullifiers.circom";
            component main = VerifyNullifiers(1);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

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
    roots = [8535830982580873324102152099762196200612343389386448806089755383816302591333n];
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
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
