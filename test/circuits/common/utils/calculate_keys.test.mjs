import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;

describe('Test calculate keys', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'calculate_keys_tester.circom');
  let circuit;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/calculate_keys.circom";
            component main = CalculateKeys();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);
  });

  after(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should calculate nullifier and zkp public key from the root key', async () => {
    const input = {
      rootKey: '0x50a6418e197469dc4aa1904544402df5e74f5f3868de6925a1b7367681b2a71',
    };

    const output = {
      nullifierKeys: 2787930237336587100082278872894775204779579143121290092412627049109578277791n,
      zkpPublicKeys: [
        8490685904787475746369366901729727151930997402058548597274067437080179631982n,
        16019898780588040648157153023567746553375452631966740349901590026272037097498n,
      ],
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });
});
