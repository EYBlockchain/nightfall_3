import assert from 'assert';
import gen from 'general-number';
import {
  compressG1,
  decompressG1,
  compressG2,
  decompressG2,
  compressProof,
  decompressProof,
} from '../utils/curve-maths/curves.mjs';
import Proof from '../classes/proof.mjs';

const { generalise } = gen;

const testProof = {
  pi_a: [
    '0x2d79b57403a0bc4a65c4953b0b63052de3264282e045b25b00af4ca310c0acde',
    '0x0adc4514da97d5b629f08a0021273d38e84948c5e8dd9d26518ef8f62b25e404',
  ],
  pi_b: [
    [
      '0x0a875f4b4debdc23b6420be63c11980dcd662e7a7d40dfe3906f14b258fb547b',
      '0x10ffa8e73f358543dd617aa0a7a29f3c4d11a4664d8f6e4bea26c2a02345304f',
    ],
    [
      '0x214be951b90cbf3467c097e52b01ade56e1a82136a139173bfb1ffc3abb35e64',
      '0x16bfa75d11f7e47c71ae733bbaa784e6166bf3ce6d20b5510f1cff17b13899a9',
    ],
  ],
  pi_c: [
    '0x270fc6470007376b20ebb4bb5bd44effa470df4db6ce8284e9eeda02f113d105',
    '0x2914ac1373b129494fa2559199259685bbbd66d3bc77e3303d8775ddf5df74b5',
  ],
};

describe('Compression tests', () => {
  it('should compress and decompress G1 points, recovering the original', async () => {
    const [compressedG1a, compressedG1c] = await Promise.all([
      compressG1(testProof.pi_a),
      compressG1(testProof.pi_c),
    ]);
    const [decompressedG1a, decompressedG1c] = [
      decompressG1(compressedG1a),
      decompressG1(compressedG1c),
    ];
    assert.deepStrictEqual(testProof.pi_a, decompressedG1a);
    assert.deepStrictEqual(testProof.pi_c, decompressedG1c);
  });

  it('should compress and decompress a G2 point, recovering the original', async () => {
    const compressedG2b = await Promise.all(compressG2(testProof.pi_b));
    const decompressedG2b = decompressG2(compressedG2b);
    assert.deepStrictEqual(testProof.pi_b, decompressedG2b);
  });

  it('should compress and decompress a G16 proof object', async () => {
    const compressedProof = await compressProof(testProof);
    const decompressedProof = decompressProof(compressedProof);
    const flatProof = generalise(Proof.flatProof(testProof)).all.hex(32);
    assert.deepStrictEqual(flatProof, decompressedProof);
  });

  it('should compress and decompress a flattened G16 proof array', async () => {
    const compressedProof = await compressProof(Object.values(testProof).flat(Infinity));
    const decompressedProof = decompressProof(compressedProof);
    const flatProof = generalise(Proof.flatProof(testProof)).all.hex(32);
    assert.deepStrictEqual(flatProof, decompressedProof);
  });

  it('BIG ISSUE!!', async () => {
    const flatProof = Object.values(testProof).flat(Infinity);
    console.log('flatProof', flatProof);
    const compressedProof = compressProof(flatProof);
    console.log('compressedProof', generalise(compressedProof).all.hex(32));
    console.log('-----------------------------------');
    // console.log(flatProof.map(p => BigInt(p).toString(2).padStart(256, '0')));
    // console.log(compressedProof.map(p => BigInt(p).toString(2).padStart(256, '0')));
    const flatProof2 = Object.values(testProof).flat(Infinity);
    for (const i of [1, 4, 5, 7]) {
      const parity = BigInt(flatProof2[i]).toString(2).slice(-1); // extract last binary digit
      if (parity === '0')
        flatProof2[i] = '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    console.log('flatProof2', flatProof2);
    const compressedProof2 = compressProof(flatProof2);
    console.log('compressedProof2', generalise(compressedProof2).all.hex(32));
  });
});

// 0, 2, 3, 6;
