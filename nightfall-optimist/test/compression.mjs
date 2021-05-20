import assert from 'assert';
import { compressG1, decompressG1, scalarMult } from '../src/utils/curve-maths/curves.mjs';
import rand from '../src/utils/crypto/crypto-random.mjs';

describe('compression tests', () => {
  const generator = [1n, 2n];
  it('should compress and decompress an G1 point, recovering the original', async () => {
    const G1 = scalarMult(rand(32).bigInt, generator); // make a random curve point
    const compressedG1 = compressG1(G1);
    const decompressedG1 = decompressG1(compressedG1);
    assert.deepStrictEqual(G1, decompressedG1);
  });
});
