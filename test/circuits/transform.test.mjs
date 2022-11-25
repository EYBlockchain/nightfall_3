import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test tokenise circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, '../../nightfall-deployer/circuits/transform.circom');
  let circuit;
  let witnessInput;

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    witnessInput = {
      value: '0',
      fee: '1',
      circuitHash: '440846153647',
      tokenType: '0',
      historicRootBlockNumberL2: ['1', '1', '0', '0', '0', '0'],
      ercAddress: '0',
      tokenId: ['0', '0', '0', '0', '0', '0', '0', '0'],
      recipientAddress: '0',
      commitments: [
        '207674219080902511135359945845078660753324057960452249383935178435370007010',
        '10997802380526709636217925448180346343998214740457559877239356868846462451621',
        '2783020742024026490208002701144574852978547445753817883872734695100160758409',
        '0',
        '0',
      ],
      nullifiers: [
        '10309017998697285043928036158487178132800429898387967179516549901023926304730',
        '0',
        '17839349917737445608963958271644053091436585309315125959599855888419242427390',
        '0',
        '0',
        '0',
      ],
      compressedSecrets: ['0', '0'],
      roots: [
        '5927476131770533696586466799177370979847377776084518268682007534850182978008',
        '0',
        '5927476131770533696586466799177370979847377776084518268682007534850182978008',
        '0',
        '0',
        '0',
      ],
      feeAddress: '1319533947831612348694315757168650042041713553662',
      rootKey: '2279923558995011751611063584918713773156544989985830828459384641106187332209',
      nullifiersValues: ['9', '0', '1', '0', '0', '0'],
      nullifiersSalts: [
        '4856328376397961122105797071237972097051370838836301804584594997126961619118',
        '0',
        '5082426700812221037617887271907426792555283114700231875108579624986251354487',
        '0',
        '0',
        '0',
      ],
      paths: [
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '7481544970485980191341165932886013182789459205057068894141500333109937969836',
          '12949719002752935401668020857667891866162650093843894178510935747658183939303',
        ],
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '7481544970485980191341165932886013182789459205057068894141500333109937969836',
          '3146991785807886564888971214638356339154222495530877854121309028274635100257',
        ],
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
        ],
      ],
      orders: ['3', '0', '2', '0', '0', '0'],
      commitmentsValues: ['8', '1', '1', '0', '0'],
      commitmentsSalts: [
        '18182204994664668807375041447355338251764026916491687024686377840133767414366',
        '12063967894597212114158019265693976531327782566684625300437339841874797014929',
        '4756948877415827795681929388371918431293235134807037988114636691828152896596',
        '0',
        '0',
      ],
      recipientPublicKey: [
        [
          '8490685904787475746369366901729727151930997402058548597274067437080179631982',
          '16019898780588040648157153023567746553375452631966740349901590026272037097498',
        ],
        [
          '8490685904787475746369366901729727151930997402058548597274067437080179631982',
          '16019898780588040648157153023567746553375452631966740349901590026272037097498',
        ],
        [
          '8490685904787475746369366901729727151930997402058548597274067437080179631982',
          '16019898780588040648157153023567746553375452631966740349901590026272037097498',
        ],
        ['0', '0'],
        ['0', '0'],
      ],
      inputPackedAddressesPrivate: [
        '21711016731996786641919559689181659195500147010365013840184326362539582930271',
        '0',
        '0',
        '0',
      ],
      inputIdRemaindersPrivate: ['1', '0', '0', '0'],
      outputPackedAddressesPrivate: [
        '21711016731996786641919559689181659195500147010365013840184326362539582930271',
        '21711016731996786641919559689181659195500147010365013840184326362539582930271',
        '0',
        '0',
      ],
      outputIdRemaindersPrivate: ['3', '4', '0', '0'],
    };
  });

  it('should verify a valid transform', async () => {
    const w = await circuit.calculateWitness(witnessInput);
    await circuit.assertOut(w, {});
  });
});
