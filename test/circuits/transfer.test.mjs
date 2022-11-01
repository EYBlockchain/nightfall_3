// import chai from 'chai';
import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test transfer circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, '../../nightfall-deployer/circuits/transfer.circom');
  let circuit;

  let value;
  let fee;
  const transactionType = '1';
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
  let rootKey;
  let nullifiersValues;
  let nullifiersSalts;
  let paths;
  let orders;
  let commitmentsSalts;
  let commitmentsValues;
  let recipientPublicKey;
  let packedErcAddressPrivate;
  let idRemainderPrivate;
  let ephemeralKey;

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    value = '0';
    fee = '1';
    tokenType = '0';
    tokenId = [
      '1383280089',
      '3518546394',
      '3719684205',
      '3857016417',
      '2066892461',
      '1469971658',
      '3256528173',
      '312823736',
    ];
    historicRootBlockNumberL2 = ['2', '0', '0', '0'];
    ercAddress = '132879599395472219364501254852296720465866736717521941213348774738587710070';
    commitments = [
      '17757779475771887336357842275909057132037232354039100658148751003055531261983',
      '12554361619243879049908583107882479056516016877280674758017429953383772997808',
      '0',
    ];
    nullifiers = [
      '117197709477382921538019157130002666423833032783762819352913222960882908146',
      '14300342375687883043781581600514382717671282147270299098452723711992633103162',
      '0',
      '0',
    ];
    compressedSecrets = [
      '21168098505838680327273190678857184515054246835679269731579160077666503959877',
      '10169841309943788425388858633837196980948099681313251904021825048923098020873',
    ];
    roots = [
      '20964734282951928498431654994464533343258690792797020655572338130275330702810',
      '3255859854610022712078710786625410158921384524803529764848754866431549438369',
      '0',
      '0',
    ];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    recipientAddress =
      '7756502216251446190890576589102414109278544248834858022081187213535079180632';
    rootKey = '2279923558995011751611063584918713773156544989985830828459384641106187332209';
    nullifiersValues = ['0', '10', '0', '0'];
    nullifiersSalts = [
      '15340017689176527589104004637940033165402219799349309558245567952247042957987',
      '17050793308128068127075637850076756759332532730466377884930007248365074989258',
      '0',
      '0',
    ];
    paths = [
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
        '20485083585002706637081569015766164906760950525323997630771107581802573080375',
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
    ];

    orders = ['2', '0', '0', '0'];
    commitmentsValues = ['0', '9', '0'];
    commitmentsSalts = [
      '21076183789647231661714109116890378504343710611690685717543855437204853365978',
      '1522068224836897283121160171456811218383856683932886147822804168466578616752',
      '0',
    ];
    recipientPublicKey = [
      [
        '21455585142010026507269989850142987603845789706340301710583334029113247699665',
        '5026357651889742986360178720315154348945488195628612719416852550950370706302',
      ],
      [
        '8490685904787475746369366901729727151930997402058548597274067437080179631982',
        '16019898780588040648157153023567746553375452631966740349901590026272037097498',
      ],
      ['0', '0'],
    ];

    packedErcAddressPrivate = '1569275434574047503899461711674324182407852210045805191109';
    idRemainderPrivate = '3';
    ephemeralKey = '963948797541814037237923107657092227793394179262775402387658355273258414634';
  });

  it('Should verify a valid transfer', async () => {
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    const w = await circuit.calculateWitness(input);
    await circuit.assertOut(w, {});
  });

  it('Should fail if transaction has a duplicate commitment', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments: [
        '18494771599034867623561540682859693959325329137772357382989983287248677307908',
        '18494771599034867623561540682859693959325329137772357382989983287248677307908',
        '0',
      ],
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if transaction has a duplicate nullifier', async () => {
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
      nullifiers: [
        '17999105792329651812725678444463795258152753649215938181082241399954600642554',
        '17999105792329651812725678444463795258152753649215938181082241399954600642554',
        '0',
        '0',
      ],
      compressedSecrets,
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if compressed secrets is zero', async () => {
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
      compressedSecrets: ['0', '0'],
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if value is not zero', async () => {
    const input = {
      value: 3,
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if recipient address is zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress: 0,
      commitments,
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if first nullifier is zero', async () => {
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
      nullifiers: ['0', '0', '0', '0'],
      compressedSecrets,
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
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
      commitments: ['0', '0', '0'],
      nullifiers,
      compressedSecrets,
      roots,
      feeAddress,
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
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
      value,
      fee: '0',
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if verify nullifiers fail', async () => {
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders: ['1', '0', '0', '0'],
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts: ['1', '0', '0'],
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if recipientPublicKey does not match with the change', async () => {
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey: [
        [
          '21455585142010026507269989850142987603845789706340301710583334029113247699665',
          '5026357651889742986360178720315154348945488195628612719416852550950370706302',
        ],
        ['0', '0'],
        ['0', '0'],
      ],
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if verify encryption fails', async () => {
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
      rootKey,
      nullifiersValues,
      nullifiersSalts,
      paths,
      orders,
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey: 0,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
