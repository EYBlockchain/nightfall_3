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
  constructor(vkArray, curve, scheme) {
    if (!Array.isArray(vkArray)) throw new Error('The input must be an array');
    if (vkArray.length % 2 !== 0)
      throw new Error('The verification array must have an even length');
    this.scheme = scheme;
    this.curve = curve;
    this.alpha = generalise(vkArray.slice(0, 2)).all.hex(32);
    this.beta = generalise([vkArray.slice(2, 4), vkArray.slice(4, 6)]).all.hex(32);
    this.gamma = generalise([vkArray.slice(6, 8), vkArray.slice(8, 10)]).all.hex(32);
    this.delta = generalise([vkArray.slice(10, 12), vkArray.slice(12, 14)]).all.hex(32);
    this.gamma_abc = generalise(pairArray(vkArray.slice(14))).all.hex(32);
  }
}

export default VerificationKey;
