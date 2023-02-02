/* eslint-disable import/prefer-default-export */
import { scalarMult } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getRegisterPairSenderReceiver, saveRegisterPairSenderReceiver } from './database.mjs';

const { REGULATOR_PRIVATE_KEY } = constants;

const registerPairSenderReceiver = async (PKa, PKb, PKx, intermediateXB) => {
  const sharedSecret = scalarMult(
    REGULATOR_PRIVATE_KEY.bigInt,
    PKb.map(r => r.bigInt),
  );

  const { resPKa, resPKb, resPKx, resIntermediateXB, resSharedSecret } =
    await getRegisterPairSenderReceiver(PKa, PKb, PKx, intermediateXB, sharedSecret);

  if (!resPKa && !resPKb && !resPKx && !resIntermediateXB && !resSharedSecret) {
    await saveRegisterPairSenderReceiver(PKa, PKb, PKx, intermediateXB, sharedSecret);
  }

  const actualPKx = resPKx === PKx ? PKx : resPKx;

  return { sharedSecret, actualPKx };
};

export { registerPairSenderReceiver };
