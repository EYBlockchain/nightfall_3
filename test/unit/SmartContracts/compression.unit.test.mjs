import { expect } from 'chai';
import fc from 'fast-check';
import hardhat from 'hardhat';
import { buildBn128 } from 'ffjavascript';
import {
  compressG1,
  decompressG1,
  compressG2,
  decompressG2,
} from '../../../common-files/utils/curve-maths/curves.mjs';

const { ethers, upgrades } = hardhat;

const Fp = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;

const randomG1Point = async randFr => {
  const bn128 = await buildBn128();
  return bn128.G1.toObject(
    bn128.G1.toAffine(bn128.G1.timesFr(bn128.G1.g, bn128.Fr.e(randFr))),
  ).slice(0, 2);
};
const randomG2Point = async randFr => {
  const bn128 = await buildBn128();
  return bn128.G2.toObject(
    bn128.G2.toAffine(bn128.G2.timesFr(bn128.G2.g, bn128.Fr.e(randFr))),
  ).slice(0, 2);
};

describe('Test On-chain compression function', function () {
  let challenges;
  let utils;
  let merkleTree;
  let challengesUtil;

  before(async () => {
    const Verifier = await ethers.getContractFactory('Verifier');
    const verifier = await Verifier.deploy();
    await verifier.deployed();

    const Poseidon = await ethers.getContractFactory('Poseidon');
    const poseidon = await Poseidon.deploy();
    await poseidon.deployed();

    const MerkleTree = await ethers.getContractFactory('MerkleTree_Stateless', {
      libraries: {
        Poseidon: poseidon.address,
      },
    });
    merkleTree = await MerkleTree.deploy();
    await merkleTree.deployed();

    const ChallengesUtil = await ethers.getContractFactory('ChallengesUtil', {
      libraries: {
        MerkleTree_Stateless: merkleTree.address,
      },
    });
    challengesUtil = await ChallengesUtil.deploy();
    await challengesUtil.deployed();

    const Utils = await ethers.getContractFactory('Utils');
    utils = await Utils.deploy();
    await utils.deployed();

    const Challenges = await ethers.getContractFactory('Challenges', {
      libraries: {
        Verifier: verifier.address,
        ChallengesUtil: challengesUtil.address,
        Utils: utils.address,
      },
    });
    challenges = await upgrades.deployProxy(Challenges, [], {
      unsafeAllow: ['external-library-linking'],
    });
    await challenges.deployed();
  });

  it('should check compressions unit tests', async function () {
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
    const compressedG2B = compressG2(testProof.pi_b);
    const compressedG1A = compressG1(testProof.pi_a);
    const compressedG1C = compressG1(testProof.pi_c);

    const [successA, g1A] = await challenges.callStatic.decompressG1(compressedG1A);
    const [successC, g1C] = await challenges.callStatic.decompressG1(compressedG1C);
    const [successB, g2B] = await challenges.decompressG2(compressedG2B);
    // On-chain should have successful decompressed
    expect([successA, successB, successC]).to.deep.equal([true, true, true]);
    // Decompressed points should match the original points
    expect(testProof.pi_a).to.deep.equal(g1A.map(a => a.toHexString()));
    expect(testProof.pi_b).to.deep.equal(g2B.map(outer => outer.map(a => a.toHexString())));
    expect(testProof.pi_c).to.deep.equal(g1C.map(a => a.toHexString()));
  });

  it('should do property-based testing for G1 Compression/Decompression ', async () => {
    await fc.assert(
      fc.asyncProperty(fc.bigInt({ min: 1n, max: Fp - 1n }), async randFr => {
        const G1Point = await randomG1Point(randFr);
        const compressed = compressG1(G1Point);
        const [success, decompressed] = await challenges.callStatic.decompressG1(compressed);
        const localDecompress = decompressG1(compressed);
        // On-chain should have successful decompressed
        expect(success).to.eql(true);
        // On-chain decompressed points should match the original points
        // Node decompressed points should match on-chain decompression
        expect(decompressed.map(d => d.toBigInt())).to.deep.eql(G1Point);
        expect(decompressed.map(d => d.toBigInt())).to.deep.eql(
          localDecompress.map(a => BigInt(a)),
        );
      }),
      { numRuns: 10 },
    );
  });
  it('should do property-based testing for G2 Compression/Decompression', async () => {
    await fc.assert(
      fc.asyncProperty(fc.bigInt({ min: 1n, max: Fp - 1n }), async randFr => {
        const G2Point = await randomG2Point(randFr);
        const compressed = compressG2(G2Point);
        const [success, decompressed] = await challenges.decompressG2(compressed);
        const localDecompress = decompressG2(compressed);
        // On-chain should have successful decompressed
        expect(success).equal(true);
        // On-chain decompressed points should match the original points
        // Node decompressed points should match on-chain decompression
        expect(decompressed.map(d => d.map(u => u.toBigInt()))).to.deep.eql(G2Point);
        expect(decompressed.map(d => d.map(u => u.toBigInt()))).to.deep.eql(
          localDecompress.map(a => a.map(b => BigInt(b))),
        );
      }),
      { numRuns: 10 },
    );
  });

  it('should correctly handle the 0 point', async () => {
    // The point 0G is specially handled
    // While not a point on the curve, it can be detected via the 0x800...00 encoding when compressed.
    const G1Point0 = await randomG1Point(0n);
    const G2Point0 = await randomG2Point(0n);
    const G1Compressed = compressG1(G1Point0);
    const G2Compressed = compressG2(G2Point0);
    const localDecompressG1 = decompressG1(G1Compressed);
    const localDecompressG2 = decompressG2(G2Compressed);
    const [successG1, contractDecompressG1] = await challenges.callStatic.decompressG1(
      G1Compressed,
    );
    const [successG2, contractDecompressG2] = await challenges.decompressG2(G2Compressed);
    // On-chain should have reported that this is not a point on the curve.
    expect([successG1, successG2]).to.deep.equal([false, false]);
    // On-chain decompressed points should return the 0.G points.
    // Node decompressed points should match on-chain decompression
    expect(contractDecompressG1.map(d => d.toBigInt())).to.deep.eql(G1Point0);
    expect(contractDecompressG2.map(d => d.map(u => u.toBigInt()))).to.deep.eql(G2Point0);
    expect(contractDecompressG1.map(d => d.toBigInt())).to.deep.eql(
      localDecompressG1.map(a => BigInt(a)),
    );
    expect(contractDecompressG2.map(d => d.map(u => u.toBigInt()))).to.deep.eql(
      localDecompressG2.map(a => a.map(b => BigInt(b))),
    );
  });

  it('should fail if decompressing invalid G1 points', async function () {
    const p = [
      '0x00000000000000000000000000000000000000000000000000000000fdff125b',
      '0x23b189035628389ee4a0fda8337562b5d0f7e7b45fcf88ed5083ae3f151e77d5',
    ];
    const compressed = compressG1(p);
    const [success] = await challenges.callStatic.decompressG1(compressed);
    expect(success).to.eql(false);
    expect(decompressG1.bind(compressed)).to.throw();
  });
  it('should fail if decompressing invalid G2 points', async function () {
    const p = [
      [
        '0x08bce40fc98f6fcb9393c1ecb144de9d0ddcdd3526aa800db735a3c0aaa704fb',
        '0x00000000000000000000000000000000000000000000000000000000fdff125b',
      ],
      [
        '0x1ea8d30a0b75d65393129454910de05bc53b04a185377ab5b718ce5a8e85f3d0',
        '0x0ea95782b81b3875c1197ee8e174861ff250bb87329fa2b8e03b31f5b7244c2f',
      ],
    ];
    const compressed = compressG2(p);
    const [success] = await challenges.decompressG2(compressed);
    expect(success).to.eql(false);
    expect(decompressG2.bind(compressed)).to.throw();
  });
});
