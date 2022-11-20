import chai from 'chai';
import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
const { expect } = chai;

describe('Test verify commitments optional', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'verify_commitments_optional_tester.circom');
  let circuit;

  let packedErcAddress;
  let idRemainder;
  let commitmentsHashes;
  let newCommitmentsValues;
  let newCommitmentsSalts;
  let recipientPublicKey;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../../../nightfall-deployer/circuits/common/verifiers/commitments/verify_commitments_optional.circom";
            component main = VerifyCommitmentsOptional(1);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    packedErcAddress = 1569275435166204138790559704496232361194238903157722181886n;
    idRemainder = 1n;
    commitmentsHashes = [
      15908570472811760987241044485417487037477545480551374917426750687716138631406n,
    ];
    newCommitmentsValues = [10n];
    newCommitmentsSalts = [
      19419450726209544540919444871215585654016018276586511005558241445415928267443n,
    ];
    recipientPublicKey = [
      [
        8490685904787475746369366901729727151930997402058548597274067437080179631982n,
        16019898780588040648157153023567746553375452631966740349901590026272037097498n,
      ],
    ];
  });

  after(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should verify a valid commitment', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      commitmentsHashes,
      newCommitmentsValues,
      newCommitmentsSalts,
      recipientPublicKey,
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should verify a commitment whose value is zero', async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      commitmentsHashes: [0n],
      newCommitmentsValues: [0n],
      newCommitmentsSalts: [0n],
      recipientPublicKey: [[0n, 0n]],
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it("Should throw an error if a commitment can't be reconstructed", async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      commitmentsHashes,
      newCommitmentsValues,
      newCommitmentsSalts: [0n],
      recipientPublicKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it("Should throw an error if a commitment hash is zero but value isn't", async () => {
    const input = {
      packedErcAddress,
      idRemainder,
      commitmentsHashes: [0n],
      newCommitmentsValues,
      newCommitmentsSalts,
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
