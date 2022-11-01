// import chai from 'chai';
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
  const circuitPath = path.join(__dirname, '../../nightfall-deployer/circuits/tokenise.circom');
  let circuit;

  let value;
  let fee;
  const transactionType = '3';
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
    historicRootBlockNumberL2 = ['0', '0'];
    ercAddress = '0';
    commitments = [
      '1313166623246429593084644272698919593071502363368033233247421550614677235254',
      '13795926514176711409651363556113530777846871819130511983847321219523948733795',
    ];
    nullifiers = [
      '19361914569140534497371439710163441315436234882045674534770607170344888469425',
      '0',
    ];
    compressedSecrets = ['0', '0'];
    roots = ['1238158923135214511678539010701967550127808660486153268011734093437145284318', '0'];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    recipientAddress = '0';
    rootKey = '2279923558995011751611063584918713773156544989985830828459384641106187332209';
    nullifiersValues = ['10', '0'];
    nullifiersSalts = [
      '18229817256822383831082290017727107562979937067420277805181360470721804935345',
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

    orders = ['0', '0'];
    commitmentsValues = ['1', '9'];
    commitmentsSalts = [
      '16790462312303348840737270388017939400790001316276057587137079544630373466756',
      '19288797260900545636510770670502347912857351707263327459877164437871562442516',
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
    valuePrivate = '1';
  });

  it('Should verify a valid tokenise', async () => {
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
      valuePrivate,
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
      transactionType,
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
      transactionType,
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
      transactionType,
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
      transactionType,
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
      transactionType,
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
      commitments: ['0', '0'],
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
      orders: ['1', '0'],
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
