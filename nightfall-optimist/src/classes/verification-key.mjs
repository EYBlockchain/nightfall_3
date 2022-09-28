/**
Class for constructing a verification key, if you have a flattened version of the key, such as the Shield contract consumes.
@param {Array} vk - the flattened vk object's values
*/
// helper function - outputs an array as an array of pairs
function pairArray(a, n = 2) {
  const b = [];
  for (let i = 0; i < a.length; i += n) b.push(a.slice(i, i + n));
  return b;
}

class VerificationKey {
  // eslint-disable-next-line no-unused-vars
  constructor(vkArray, curve, scheme, nPublicInputs) {
    if (!Array.isArray(vkArray)) throw new Error('The input must be an array');
    this.protocol = scheme;
    this.curve = curve;
    this.nPublic = nPublicInputs;
    this.vk_alpha_1 = vkArray.slice(0, 3);
    this.vk_beta_2 = pairArray(vkArray.slice(3, 9), 2);
    this.vk_gamma_2 = pairArray(vkArray.slice(9, 15), 2);
    this.vk_delta_2 = pairArray(vkArray.slice(15, 21), 2);
    this.vk_alphabeta_12 = [
      pairArray(vkArray.slice(21, 27), 2),
      pairArray(vkArray.slice(27, 33), 2),
    ];
    this.IC = pairArray(vkArray.slice(33), 3);
  }
}

export default VerificationKey;
