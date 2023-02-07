/* eslint-disable import/prefer-default-export */
import { scalarMult } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getRegisterPairSenderReceiver, saveRegisterPairSenderReceiver } from './database.mjs';

const { REGULATOR_PRIVATE_KEY } = constants;

const registerPairSenderReceiver = async (PKSender, PKReceiver, transferPublicKey, sharedPubRegulator) => {
  const sharedPubSender = scalarMult(
    REGULATOR_PRIVATE_KEY.bigInt,
    PKSender.map(r => r.bigInt),
  );

  const sharedPubReceiver = scalarMult(
    REGULATOR_PRIVATE_KEY.bigInt,
    PKReceiver.map(r => r.bigInt),
  );

  const registerPairSenderReceiver =
    await getRegisterPairSenderReceiver(PKSender, PKReceiver, transferPublicKey, sharedPubRegulator, sharedPubSender, sharedPubReceiver);

  if (!registerPairSenderReceiver) {
    await saveRegisterPairSenderReceiver(PKSender, PKReceiver, transferPublicKey, sharedPubRegulator, sharedSecret, sharedPubSender, sharedPubReceiver);
  }

  return { sharedPubSender, sharedPubReceiver };
};

export { registerPairSenderReceiver };
