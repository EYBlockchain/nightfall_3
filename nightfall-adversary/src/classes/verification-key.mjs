/**
Class for constructing a verification key, if you have a flattened version of the key, such as the Shield contract consumes.
@param {Array} vk - the flattened vk object's values
*/
import gen from 'general-number';

const { generalise } = gen;
// helper function - outputs an array as an array of pairs
function pairArray(a) {
  const b = [];
  for (let i = 0; i < a.length; i += 2) b.push(a.slice(i, i + 2));
  return b;
}

class VerificationKey {
  constructor(vkArray) {
    if (!Array.isArray(vkArray)) throw new Error('The input must be an array');
    if (vkArray.length % 2 !== 0)
      throw new Error('The verification array must have an even length');
    this.h = generalise([vkArray.slice(0, 2), vkArray.slice(2, 4)]).all.hex(32);
    this.g_alpha = generalise(vkArray.slice(4, 6)).all.hex(32);
    this.h_beta = generalise([vkArray.slice(6, 8), vkArray.slice(8, 10)]).all.hex(32);
    this.g_gamma = generalise(vkArray.slice(10, 12)).all.hex(32);
    this.h_gamma = generalise([vkArray.slice(12, 14), vkArray.slice(14, 16)]).all.hex(32);
    this.query = generalise(pairArray(vkArray.slice(16))).all.hex(32);
  }
}

export default VerificationKey;
