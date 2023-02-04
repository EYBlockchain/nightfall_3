// import chai from 'chai';
import path from 'path';
import circomTester from 'circom_tester';
import { fileURLToPath } from 'url';
// import { generalise } from 'general-number';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
// const { expect } = chai;

describe('Test transfer regulator circuit', function () {
  this.timeout(60000);
  const circuitPath = path.join(
    __dirname,
    '../../../nightfall-deployer/circuits/transfer_regulator.circom',
  );
  let circuit;

  let value;
  let fee;
  const circuitHash = '1';
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
  let sharedPubSender;

  before(async () => {
    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    value = '52615104113680';
    fee = '1';
    tokenType = '0';
    historicRootBlockNumberL2 = ['0', '2', '0', '0'];
    ercAddress = '11037928113065011723621837603297555372128306067490168468476261520333215016451';
    tokenId = [
      '2767640935',
      '2692862831',
      '1366970421',
      '341149654',
      '3926962466',
      '3136837739',
      '2024592492',
      '1079674086',
    ];
    recipientAddress =
      '7204897914463877751569834808582585821054161548271355365331299819830610376760';
    commitments = [
      '14152439929049712769864808654206087814269625799394135115988216087473179820627',
      '15934666674837230553448159446654843311594766542351759235099852343111418588705',
      '0',
    ];
    nullifiers = [
      '17311493958849545193602041137608621636003642830429344983018506157521356554344',
      '2207729929134374905111074270014121907881219345201302297326087557849574514218',
      '0',
      '0',
    ];
    compressedSecrets = [
      '11585055354989698269877797980452971517592487277655690579135000134735218481243',
      '9255503910041462247771821600280469663667490657631042670808205807969725761063',
    ];
    roots = [
      '8115467701260440528096245764453859000019448019831060381341109750413454423249',
      '912572422606684321134210801401173594062464573954172864442802425149947088851',
      '0',
      '0',
    ];
    feeAddress = '1319533947831612348694315757168650042041713553662';
    rootKey = '2279923558995011751611063584918713773156544989985830828459384641106187332209';
    nullifiersValues = ['9', '9', '0', '0'];
    nullifiersSalts = [
      '20513902764086722279230790388316452049712019845264173356954799219117530020083',
      '10841558031173063604568111398826688175705902243878693366886722960342536541599',
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
        '525251941230013484363380026201828190666339810465305938728643722253281424202',
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
    orders = ['0', '2', '0', '0'];
    commitmentsValues = ['10', '7', '0'];
    commitmentsSalts = [
      '12151054110963596045688559756029865234382274992995212084244447308464320651325',
      '17683441280872854890097587392811695118644690590701452057917597918623544285485',
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
    packedErcAddressPrivate = '1319533947831612348694315757168650042041713553662';
    idRemainderPrivate = '0';
    ephemeralKey = '909701221553055453461978359737195753310684621371530022208323508315457158526';
    sharedPubSender = [
      '7854089346243255544872520686583446599765321252248122998010154744180687431657',
      '15142832371551347777184090185309351432826131118144007300084258255168829320473',
    ];
  });

  it('Should verify a valid transfer', async () => {
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
      ephemeralKey,
      sharedPubSender,
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
      sharedPubSender,
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
      sharedPubSender,
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
      circuitHash,
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
      sharedPubSender,
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
      circuitHash,
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
      sharedPubSender,
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
      circuitHash,
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
      sharedPubSender,
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
      sharedPubSender,
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
      circuitHash,
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
      sharedPubSender,
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
      ephemeralKey,
      sharedPubSender,
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
      orders: ['1', '0', '0', '0'],
      commitmentsValues,
      commitmentsSalts,
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
      sharedPubSender,
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
      commitmentsSalts: ['1', '0', '0'],
      recipientPublicKey,
      packedErcAddressPrivate,
      idRemainderPrivate,
      ephemeralKey,
      sharedPubSender,
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
      sharedPubSender,
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
      ephemeralKey: 0,
      sharedPubSender,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
