import chai from 'chai';
import path from 'path';
import fs from 'fs';
import circomTester from 'circom_tester';
import gen from 'general-number';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tester = circomTester.wasm;
const { expect } = chai;
const { generalise } = gen;

describe('Test verify encryption', function () {
  this.timeout(60000);
  const circuitPath = path.join(__dirname, 'verify_encryption_tester.circom');
  let circuit;

  let cipherText;
  let packedErcAddress;
  let idRemainder;
  let newCommitmentValue;
  let newCommitmentSalt;
  let recipientPublicKey;
  let ephemeralPublicKeyCompressed;
  let ephemeralKey;

  before(async () => {
    const circuitCode = `
            pragma circom 2.1.0;
            include "../../../../nightfall-deployer/circuits/common/verifiers/verify_encryption.circom";
            component main = VerifyEncryption();
        `;

    fs.writeFileSync(circuitPath, circuitCode, 'utf8');

    circuit = await tester(circuitPath, { reduceConstraints: false });
    await circuit.loadConstraints();
    console.log(`Constraints: ${circuit.constraints.length}\n`);

    cipherText = [
      236781585185648911860976428372737497872310998277968728911011437320300834203n,
      14243080935542763374319817184861259925496338518378514291687737710634664345589n,
      10970731559091673129853681238000201198693277833824102995269742211489136795386n,
      10873988614707087088956515116495962442129161181014041628011641187028030856000n,
    ];
    packedErcAddress = 1319533947831612348694315757168650042041713553662n;
    idRemainder = 0n;
    newCommitmentValue = 10n;
    newCommitmentSalt =
      2885662944555114896980443645398093008736283054147474298161600919940174454793n;
    recipientPublicKey = [
      8490685904787475746369366901729727151930997402058548597274067437080179631982n,
      16019898780588040648157153023567746553375452631966740349901590026272037097498n,
    ];
    ephemeralPublicKeyCompressed = generalise(
      717939935144212972627806658558897856614582312098612649325566281897073665141n,
    )
      .limbs(1, 256)
      .reverse();
    ephemeralKey = 504678411199147242171318864882976996303859145891105094823876398537183550136n;
  });

  after(async () => {
    fs.unlinkSync(circuitPath);
  });

  it('Should verify a valid encryption', async () => {
    const input = {
      cipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed,
      ephemeralKey,
    };

    const output = {
      valid: 1,
    };

    const w = await circuit.calculateWitness(input, { logOutput: false });
    await circuit.assertOut(w, output);
  });

  it('Should fail if ercAddress is not the first element of the cipher text', async () => {
    const badCipherText = [
      10873988613456789095828602958185691069156161181014041628011641187028030856000n,
      14243080935542763374319817184861259925496338518378514291687737710634664345589n,
      10970731559091673129853681238000201198693277833824102995269742211489136795386n,
      10873988614707087088956515116495962442129161181014041628011641187028030856000n,
    ];
    const input = {
      cipherText: badCipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if tokenId is not the second element of the cipher text', async () => {
    const badCipherText = [
      236781585185648911860976428372737497872310998277968728911011437320300834203n,
      10873988613456789095828602958185691069156161181014041628011641187028030856000n,
      10970731559091673129853681238000201198693277833824102995269742211489136795386n,
      10873988614707087088956515116495962442129161181014041628011641187028030856000n,
    ];
    const input = {
      cipherText: badCipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if first element of compressed secrets is not the third element of the cipher text', async () => {
    const badCipherText = [
      236781585185648911860976428372737497872310998277968728911011437320300834203n,
      14243080935542763374319817184861259925496338518378514291687737710634664345589n,
      10873988613456789095828602958185691069156161181014041628011641187028030856000n,
      10873988614707087088956515116495962442129161181014041628011641187028030856000n,
    ];
    const input = {
      cipherText: badCipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if second element of compressed secrets is not the last element of the cipher text', async () => {
    const badCipherText = [
      236781585185648911860976428372737497872310998277968728911011437320300834203n,
      14243080935542763374319817184861259925496338518378514291687737710634664345589n,
      10970731559091673129853681238000201198693277833824102995269742211489136795386n,
      10873988613456789095828602958185691069156161181014041628011641187028030856000n,
    ];
    const input = {
      cipherText: badCipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed,
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });

  it('Should fail if compressedPoint is different than recipient address', async () => {
    const input = {
      cipherText,
      packedErcAddress,
      idRemainder,
      newCommitmentValue,
      newCommitmentSalt,
      recipientPublicKey,
      ephemeralPublicKeyCompressed: generalise(
        10873988613456789095828602958185691069156161181014041628011641187028030856000n,
      )
        .limbs(1, 256)
        .reverse(),
      ephemeralKey,
    };

    try {
      await circuit.calculateWitness(input, { logOutput: false });
      expect(true).to.be.equal(false);
    } catch (error) {
      expect(error.message.includes('Assert Failed')).to.be.equal(true);
    }
  });
});
