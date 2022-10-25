import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import gen from 'general-number';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
const { generalise } = gen;

describe('Test Kem Dem', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'kem_dem_tester.circom');

  this.afterEach(async () => {
    fs.unlinkSync(circuitPath);
  });

  console.log(
    generalise(717939935144212972627806658558897856614582312098612649325566281897073665141n)
      .limbs(32, 8)
      .reverse(),
  );

  const ephemeralKey =
    16260906323203770711968677686196580709356476872542307288522583085146316514824n;
  const recipientPub = [
    12013815766362108993719144008473072333420371795023243899212402457489203162634n,
    8797741793274323037562896505110323496800801895337147285962830335415772202396n,
  ];
  const encryptionKey =
    18582250374537200214625112385595304642366771765559811842930522871516163926835n;
  const plainText = [
    28n,
    21888242871839275222246405745257275088548364400416034343698204186575808495568n,
    23n,
  ];

  const cipherText = [
    2599551847581187203435764291933381322356059885152688069014474516908219311943n,
    9494593136853204745840817655241593501954407903655730382778583248585546879498n,
    15722668196743245929257425743418509382122443165461871570109005646518920423203n,
  ];

  const ephemeralPublicKey = [
    8372853911697345462797962956752888407922845216620737910760695582172174417080n,
    15061810054049789157039409197397697505121321685370222771260352999332184052733n,
  ];

  it('Should verify KEM', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/kem_dem.circom";
            component main = Kem();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    const circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      ephemeralKey: generalise(ephemeralKey).limbs(1, 256).reverse(),
      recipientPub,
    };
    const output = {
      encryptionKey,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should verify DEM', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/kem_dem.circom";
            component main = Dem(3);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    const circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      encryptionKey,
      plainText,
    };
    const output = {
      cipherText,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should verify KEM-DEM', async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/utils/kem_dem.circom";
            component main = KemDem(3);
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    const circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    const input = {
      ephemeralKey,
      recipientPub,
      plainText,
    };
    const output = {
      cipherText,
      ephemeralPublicKey,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });
});
