// import chai from 'chai';
import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test burn circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, '../../../nightfall-deployer/circuits/burn.circom');
  let circuit;

  let value;
  let fee;
  const circuitHash = '4';
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
  let valuePrivate;

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    value = '0';
    fee = '1';
    tokenType = '0';
    tokenId = ['0', '0', '0', '0', '0', '0', '0', '0'];
    historicRootBlockNumberL2 = ['2', '2', '0'];
    ercAddress = '0';
    commitments = [
      '16375765543079323602529377570070023885410445967535428085833109742976453595894',
      '18707536334705882256869311881167201810355473445932762964237349831507871442386',
    ];
    nullifiers = [
      '7282396293468696541787692821799319645402325477708549771055867669166529046302',
      '5665660959676054353752818697098428062741333526418201927541295922806967195106',
      '0',
    ];
    compressedSecrets = ['0', '0'];
    roots = [
      '1415033194412474259604457225946249736927324822014018173178295842554598286714',
      '1415033194412474259604457225946249736927324822014018173178295842554598286714',
      '0',
    ];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    recipientAddress = '0';
    rootKey = '2279923558995011751611063584918713773156544989985830828459384641106187332209';
    nullifiersValues = ['5', '8', '0'];
    nullifiersSalts = [
      '1148036745128417359917070962024254213109377584646006074738607786607848625585',
      '1118528393993997824675296443684053194374662027509797001442461774032464070117',
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
        '3067214235569605348053524621998343395561574295199234413368570087079442800289',
        '18522342711066106425961359570360419829060169902806176026128797812172152392682',
        '13795926514176711409651363556113530777846871819130511983847321219523948733795',
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
        '2184076416084575252155788950520993737142087411043641888726720976784217542467',
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

    orders = ['3', '4', '0'];
    commitmentsValues = ['1', '7'];
    commitmentsSalts = [
      '21410471382643710744442571469981294631414048971628290436304391481694453066466',
      '4698247583643147343025590386834825758712559730779777460381049927871782298629',
    ];
    recipientPublicKey = [
      [
        [
          '8490685904787475746369366901729727151930997402058548597274067437080179631982',
          '16019898780588040648157153023567746553375452631966740349901590026272037097498',
        ],
        [
          '8490685904787475746369366901729727151930997402058548597274067437080179631982',
          '16019898780588040648157153023567746553375452631966740349901590026272037097498',
        ],
      ],
    ];

    packedErcAddressPrivate =
      '21711016731996786641919559690090612179745446532414748301311487203631771980383';
    idRemainderPrivate = '11';
    valuePrivate = '4';
  });

  it('Should verify a valid burn', async () => {
    const input = {
      value,
      fee,
      circuitHash,
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
      valuePrivate,
    };

    const w = await circuit.calculateWitness(input);
    await circuit.assertOut(w, {});
  });

  it('Should fail if transaction has a duplicate commitment', async () => {
    const input = {
      value,
      fee,
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments: [
        '18494771599034867623561540682859693959325329137772357382989983287248677307908',
        '18494771599034867623561540682859693959325329137772357382989983287248677307908',
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
      valuePrivate,
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
      circuitHash,
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
      valuePrivate,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if compressed secrets is not zero', async () => {
    const input = {
      value,
      fee,
      circuitHash,
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
      valuePrivate,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if ercAddress is not zero', async () => {
    const input = {
      value,
      fee,
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress: '17999105792329651812725678444463795258152753649215938181082241399954600642554',
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
      valuePrivate,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if ercAddress private is not valid for l2 tokenisation', async () => {
    const input = {
      value,
      fee,
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress: '1319533947831612348694315757168650042041713553662',
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
      valuePrivate,
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
      circuitHash,
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
      valuePrivate,
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
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress:
        '17999105792329651812725678444463795258152753649215938181082241399954600642554',
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
      valuePrivate,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenId is not zero', async () => {
    const input = {
      value,
      fee,
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId: ['0', '0', '0', '0', '0', '0', '1', '1'],
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
      valuePrivate,
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
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId,
      recipientAddress,
      commitments,
      nullifiers: ['0', '0', '0'],
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
      valuePrivate,
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
      circuitHash,
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
      valuePrivate: '24',
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
      circuitHash,
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
      orders: ['1', '0', '0'],
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      valuePrivate,
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
      circuitHash,
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
      commitmentsSalts: ['1', '0'],
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      valuePrivate,
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
      circuitHash,
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
        ['0', '0'],
        ['0', '0'],
      ],
      packedErcAddressPrivate,
      idRemainderPrivate,
      valuePrivate,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
