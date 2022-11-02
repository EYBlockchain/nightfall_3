import { initialize } from 'zokrates-js';

/**
 * Takes in a proof and a verification key and determines if the proof verifies.
 * @param {String} vk - Verification Key
 * @param {String} proof
 * @param {String} backEnd - Available options are 'libsnark', 'bellman', 'ark'
 * @param {Array} inputs - Array containing all the public inputs
 * @returns {Object} JSON of the proof.
 */

const defaultProvider = await initialize();

const zokratesProvider = defaultProvider.withOptions({
  backend: 'bellman',
  curve: 'bn128',
  scheme: 'g16',
});

export default async function verify({
  vk,
  proof,
  inputs,
  provingScheme = 'g16',
  backend = 'bellman',
  curve = 'bn128',
}) {
  let combinedProof = { scheme: provingScheme, curve, proof };

  if (!proof.inputs) combinedProof = { ...combinedProof, inputs };

  const isVerified = await zokratesProvider.verify(vk, combinedProof);
  return isVerified;
}
