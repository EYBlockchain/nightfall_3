import chai from 'chai';
import { generalise, GN } from 'general-number';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import { ZkpKeys } from '../nightfall-client/src/services/keys.mjs';
import { Secrets, Commitment } from '../nightfall-client/src/classes/index.mjs';

const BN128_GROUP_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ZKP_KEY_LENGTH = 32; // use a 32 byte key length for SHA compatibility
const { expect } = chai;
const mnemonic =
  'control series album tribe category saddle prosper enforce moon eternal talk fame';
// 'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction';
// 'high return hold whale promote payment hat panel reduce oyster ramp mouse';
// 'crush power outer gadget enter maze advance rather divert monster indoor axis';
// 'smart base soup sister army address member poem point quick save penalty';
const ercAddress = '0x9b7bd670d87c3dd5c808ba627c75ba7e88ad066f';
const tokenId = '0x00';
const values = '0xc';

describe('Testing encrypt and decrypt in Secrets class', () => {
  let potentialSalt;
  let potentialCommitment;
  let recipientZkpPublicKey;
  let recipientZkpPrivateKey;
  before(async () => {
    const keys = await ZkpKeys.generateZkpKeysFromMnemonic(mnemonic, '0');

    recipientZkpPublicKey = generalise(keys.zkpPublicKey);
    const recipientCompressedZkpPublicKey = keys.compressedZkpPublicKey;
    recipientZkpPrivateKey = new GN(keys.zkpPrivateKey);
    do {
      // eslint-disable-next-line no-await-in-loop
      potentialSalt = new GN((await rand(ZKP_KEY_LENGTH)).bigInt % BN128_GROUP_ORDER).hex(32);
      potentialCommitment = new Commitment({
        ercAddress,
        tokenId,
        value: values,
        zkpPublicKey: recipientZkpPublicKey,
        compressedZkpPublicKey: recipientCompressedZkpPublicKey,
        salt: potentialSalt,
      });
    } while (potentialCommitment.hash.bigInt > BN128_GROUP_ORDER);
  });

  it('Should successfully decrypt an encrypted secret', async () => {
    const encryptedSecrets = await Secrets.encryptSecrets(
      [
        new GN(ercAddress).bigInt,
        new GN(tokenId).bigInt,
        new GN(values).bigInt,
        new GN(potentialSalt).bigInt,
      ],
      [recipientZkpPublicKey[0].bigInt, recipientZkpPublicKey[1].bigInt],
    );

    const decryptedSecrets = await Secrets.decryptSecrets(
      encryptedSecrets.cipherText.all.bigInt,
      recipientZkpPrivateKey.bigInt,
      potentialCommitment.hash.hex(32),
    );

    expect(potentialCommitment.hash.hex(32)).to.be.equal(decryptedSecrets.hash.hex(32));
  });
});
