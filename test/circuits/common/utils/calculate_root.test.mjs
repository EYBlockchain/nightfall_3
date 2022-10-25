import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;

describe('Test calculate root', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'calculate_root_tester.circom');
  let circuit;

  afterEach(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should set the correct order of the pathNode and siblingNode if order is 1', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/calculate_root.circom";
            component main = OrderFields();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      order: 1n,
      pathNode: 5327868679247318954928386051486537715306164644798440303400293824122784967797n,
      siblingNode: 0n,
    };

    const output = {
      left: 0n,
      right: 5327868679247318954928386051486537715306164644798440303400293824122784967797n,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should set the correct order of the pathNode and siblingNode if order is 0', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/calculate_root.circom";
            component main = OrderFields();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      order: 0n,
      pathNode: 5327868679247318954928386051486537715306164644798440303400293824122784967797n,
      siblingNode: 0n,
    };

    const output = {
      left: 5327868679247318954928386051486537715306164644798440303400293824122784967797n,
      right: 0n,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should calculate root of the merkle tree from the hash, siblingPath and order', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/calculate_root.circom";
            component main = CalculateRoot();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      siblingPath: [
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
      order: 4n,
      hash: 5327868679247318954928386051486537715306164644798440303400293824122784967797n,
    };

    const output = {
      root: 8535830982580873324102152099762196200612343389386448806089755383816302591333n,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });
});
