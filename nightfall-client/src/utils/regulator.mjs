import { scalarMult } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

/**
This function registers the sender-receiver to the regulator and gets the sharedPub for the sender to generate the secret.
@function registerPairSenderReceiv1er
@param {String} regulatorUrl - regulator Url for registering the pair sender receiver
@param {String} senderPublicKey - sender public key
@param {String} receiverPublicKey - receiver public key
@param {String} transferPublicKey - transfer public key
@param {String} transferPrivateKey - transfer private key
@returns {[String, String]} [sharedPubSender, sharedPubReceiver] - shared public secret for sender and receiver
*/
const registerPairSenderReceiverToRegulator = (
  regulatorUrl,
  senderPublicKey,
  receiverPublicKey,
  transferPublicKey,
  transferPrivateKey,
) => {
  const sharedPubRegulator = scalarMult(
    transferPrivateKey.bigInt,
    receiverPublicKey.map(r => r.bigInt),
  );

  // ------------- REGULATOR SERVICE CALL AND RESPONSE -----------------------
  // registerPairSenderReceiver (PKa, PKb, PKx, pkx * PKb) in the Regulator Service and receive response
  // TODO: call to Regulator service to get the sharedPubSender. Now we simulate with private from the sender
  logger.debug({
    msg: `Registering sender-receiver to regulator ${regulatorUrl}`,
    senderPublicKey,
    receiverPublicKey,
    transferPublicKey,
    sharedPubRegulator,
  });

  const privateKeyRegulator = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e'; // test private key for mock regulator
  // This simulate the response from the regulator (regulatorPublicKey, sharedPubSender)
  // const regulatorPublicKey = scalarMult(BigInt(privateKeyRegulator), BABYJUBJUB.GENERATOR);
  const sharedPubSender = scalarMult(
    BigInt(privateKeyRegulator),
    receiverPublicKey.map(pk => pk.bigInt),
  );
  const sharedPubReceiver = scalarMult(
    BigInt(privateKeyRegulator),
    transferPublicKey.map(pk => pk.bigInt),
  );
  // -----------------------------------------------------------------------------

  return [sharedPubSender, sharedPubReceiver];
};

export default registerPairSenderReceiverToRegulator;
