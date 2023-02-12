import chai from 'chai';
import fc from 'fast-check';
import { generalise } from 'general-number';
import { scalarMult } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { encrypt, decrypt, packSecrets } from '../nightfall-client/src/services/kem-dem.mjs';

const { expect } = chai;

const { BN128_GROUP_ORDER, BABYJUBJUB } = constants;

describe('KEM-DEM Regulator Tests', () => {
  describe('Check encryption and decryption', () => {
    it('decrypt . encrypt should be an identity ', () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigUint({ max: BN128_GROUP_ORDER - 1n }), { minLength: 1, maxLength: 10 }),
          fc.bigUint({ max: BN128_GROUP_ORDER - 1n }),
          fc.bigUint({ max: BN128_GROUP_ORDER - 1n }),
          fc.bigUint({ max: BN128_GROUP_ORDER - 1n }),
          fc.bigUint({ max: BigInt(2 ** 48 - 1) }),
          (plaintexts, senderPrivateKey, recipientPrivateKey, regulatorPrivateKey, nonce) => {
            const genSenderPrivateKey = generalise(senderPrivateKey);
            const recipientPublicKey = scalarMult(recipientPrivateKey, BABYJUBJUB.GENERATOR);
            const genRecipientPrivateKey = generalise(recipientPrivateKey);
            const regulatorPublicKey = scalarMult(regulatorPrivateKey, BABYJUBJUB.GENERATOR);
            // Secret Key: (senderPrivateKey * regulatorPrivateKey * recipientPublicKey) ^ nonce

            // ENCRYPT
            // 1) regulatorPrivateKey * recipientPublicKey
            const sharedPubSender = scalarMult(
              regulatorPrivateKey,
              recipientPublicKey.map(r => r),
            );
            // 2) (genSenderPrivateKey * sharedPubSender) ^ nonce
            const enc = encrypt(
              genSenderPrivateKey,
              generalise(sharedPubSender),
              plaintexts,
              nonce,
            );

            // DECRYPT
            // 1) senderPrivateKey * regulatorPublicKey
            const sharedPubReceiver = scalarMult(
              senderPrivateKey,
              regulatorPublicKey.map(r => r),
            );
            // 2) (genRecipientPrivateKey * sharedPubReceiver) ^ nonce
            const dec = decrypt(
              genRecipientPrivateKey,
              generalise(sharedPubReceiver),
              generalise(enc),
              nonce,
            );
            expect(dec).to.deep.equal(plaintexts);
          },
        ),
      );
    });
  });
});
