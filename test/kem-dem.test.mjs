import chai from 'chai';
import fc from 'fast-check';
import { generalise } from 'general-number';
import { scalarMult } from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import { encrypt, decrypt, packSecrets } from '../nightfall-client/src/services/kem-dem.mjs';

const { expect } = chai;

const { BN128_GROUP_ORDER, BABYJUBJUB } = constants;

describe('KEM-DEM Tests', () => {
  describe('Check encryption and decryption', () => {
    it('decrypt . encrypt should be an identity ', () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigUint({ max: BN128_GROUP_ORDER - 1n }), { minLength: 1, maxLength: 10 }),
          fc.bigUint({ max: BN128_GROUP_ORDER - 1n }),
          fc.bigUint({ max: BN128_GROUP_ORDER - 1n }),
          (plaintexts, senderPrivateKey, recipientPrivateKey) => {
            const senderPublicKey = scalarMult(senderPrivateKey, BABYJUBJUB.GENERATOR);
            const genSenderPrivateKey = generalise(senderPrivateKey);
            const recipientPublicKey = scalarMult(recipientPrivateKey, BABYJUBJUB.GENERATOR);
            const genRecipientPrivateKey = generalise(recipientPrivateKey);
            const enc = encrypt(genSenderPrivateKey, generalise(recipientPublicKey), plaintexts);
            const dec = decrypt(
              genRecipientPrivateKey,
              generalise(senderPublicKey),
              generalise(enc),
            );
            expect(dec).to.deep.equal(plaintexts);
          },
        ),
      );
    });
    it('packing should be reversible ', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: BN128_GROUP_ORDER - 1n }),
          fc.bigInt({ min: 0n, max: 2n ** 160n - 1n }),
          (a, b) => {
            const [unpackedA, packedB] = packSecrets(generalise(a), generalise(b), 0, 2);
            // console.log('a / b', a, b);
            // console.log('unpackedA / packedB', unpackedA, packedB);
            const [originalB, originalA] = packSecrets(packedB, unpackedA, 2, 0);
            // console.log('originalA / originalB', originalA, originalB);
            expect(originalA.bigInt).to.equal(a);
            expect(originalB.bigInt).to.equal(b);
          },
        ),
      );
    });
  });
});
