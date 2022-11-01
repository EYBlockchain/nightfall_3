// import chai from 'chai';
import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test withdraw circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, '../../nightfall-deployer/circuits/withdraw.circom');
  let circuit;

  let value;
  let fee;
  const transactionType = '2';
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

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    value = '5';
    fee = '1';
    tokenType = '0';
    tokenId = ['0', '0', '0', '0', '0', '0', '0', '0'];
    historicRootBlockNumberL2 = ['2', '0', '0', '0'];
    ercAddress = '1319533947831612348694315757168650042041713553662';
    commitments = [
      '18494771599034867623561540682859693959325329137772357382989983287248677307908',
      '0',
    ];
    nullifiers = [
      '17999105792329651812725678444463795258152753649215938181082241399954600642554',
      '0',
      '0',
      '0',
    ];
    compressedSecrets = ['0', '0'];
    roots = [
      '16104510629855866397510441013524410896893628403652911328425402315041219140901',
      '0',
      '0',
      '0',
    ];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    recipientAddress = '893705366084700132548040460931008653290460453987';
    rootKey = '2279923558995011751611063584918713773156544989985830828459384641106187332209';
    nullifiersValues = ['20', '0', '0', '0'];
    nullifiersSalts = [
      '20477589777617299046368255472506861125637179173310460066078796368305493563853',
      '0',
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
        '12682449761883199958107716752974035276811983393191668297556894866591609422504',
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
    commitmentsValues = ['14', '0'];
    commitmentsSalts = [
      '3013689188134412690498761919902750488778560214613106483992920790224887382186',
      '0',
    ];
    recipientPublicKey = [
      [
        '8490685904787475746369366901729727151930997402058548597274067437080179631982',
        '16019898780588040648157153023567746553375452631966740349901590026272037097498',
      ],
      ['0', '0'],
    ];
  });

  it('Should verify a valid withdraw', async () => {
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
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is 1 and value is different than zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType: 1,
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
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is different than 1 and value is zero', async () => {
    const input = {
      value: 0,
      fee,
      transactionType,
      tokenType: 2,
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
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenType is 0 and tokenId is different than zero', async () => {
    const input = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      ercAddress,
      tokenId: ['0', '0', '0', '0', '0', '0', '0', '1'],
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
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
