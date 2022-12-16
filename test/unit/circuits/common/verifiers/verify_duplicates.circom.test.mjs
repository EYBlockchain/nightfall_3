import chai from 'chai';
import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { expect } = chai;
const tester = circomTester.wasm;

describe('Test verify duplicates', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'verify_duplicates_tester.circom');
  let circuit;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.2;
            include "../../../../../nightfall-deployer/circuits/common/verifiers/verify_duplicates.circom";
            component main = VerifyDuplicates(4,4);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);
  });

  after(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should verify that there are no duplicates', async () => {
    const input = {
      commitments: [
        '0x12c58ed3d0e09746ba42fd4cc51ee94f3b1cd08e423c59b129e93c47d0f3e76e',
        '0x629e99fd714ee08297ee2e6b4fcf4dfa052befe0e3e6a31ac88b536f993639f',
        '0x00',
        '0x00',
      ],
      nullifiers: [
        '0x236af0fee749dd191e317fc8199f20c5b3df728bd3247db0623c3085e7ff501a',
        '0xfd714ee08297ee2e6b0efe0e721f2d97c58b1d1ccd0c80b88256a152d27f0fe',
        '0x00',
        '0x00',
      ],
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should throw an error if a non zero commitment is duplicated', async () => {
    const input = {
      commitments: [
        '0x12c58ed3d0e09746ba42fd4cc51ee94f3b1cd08e423c59b129e93c47d0f3e76e',
        '0x629e99fd714ee08297ee2e6b4fcf4dfa052befe0e3e6a31ac88b536f993639f',
        '0x629e99fd714ee08297ee2e6b4fcf4dfa052befe0e3e6a31ac88b536f993639f',
        '0x00',
      ],
      nullifiers: [
        '0x236af0fee749dd191e317fc8199f20c5b3df728bd3247db0623c3085e7ff501a',
        '0xfd714ee08297ee2e6b0efe0e721f2d97c58b1d1ccd0c80b88256a152d27f0fe',
        '0x00',
        '0x00',
      ],
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should throw an error if a non zero nullifier is duplicated', async () => {
    const input = {
      commitments: [
        '0x12c58ed3d0e09746ba42fd4cc51ee94f3b1cd08e423c59b129e93c47d0f3e76e',
        '0x629e99fd714ee08297ee2e6b4fcf4dfa052befe0e3e6a31ac88b536f993639f',
        '0x00',
        '0x00',
      ],
      nullifiers: [
        '0x236af0fee749dd191e317fc8199f20c5b3df728bd3247db0623c3085e7ff501a',
        '0xfd714ee08297ee2e6b0efe0e721f2d97c58b1d1ccd0c80b88256a152d27f0fe',
        '0xfd714ee08297ee2e6b0efe0e721f2d97c58b1d1ccd0c80b88256a152d27f0fe',
        '0x00',
      ],
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
