import config from 'config';
import { expect } from 'chai';
import hardhat from 'hardhat';
import Timber from 'common-files/classes/timber.mjs';
import logger from 'common-files/utils/logger.mjs';
import poseidonHash from 'common-files/utils/crypto/poseidon/poseidon.mjs';
import { generalise } from 'general-number';

const { ethers } = hardhat;

const { TIMBER_HEIGHT, HASH_TYPE } = config;

describe('Challenges contract Challenges functions', function () {
  let merkleTree;
  let merkleTreeMock;

  async function calculateAndVerifyRoot(leaves) {
    const emptyTree = new Timber({
      root: 0,
      frontier: [],
      leafCount: 0,
      tree: undefined,
      hashType: HASH_TYPE,
      height: TIMBER_HEIGHT,
    });
    const updatedTimber = Timber.statelessUpdate(emptyTree, leaves, HASH_TYPE, TIMBER_HEIGHT);
    const { frontier, root, leafCount } = updatedTimber;
    const frontierAfterBlock = frontier.concat(
      Array(33 - frontier.length).fill(ethers.constants.HashZero),
    );
    const merkleRoot = await merkleTreeMock.callStatic.calculateRoot(frontierAfterBlock, leafCount);
    try {
      expect(merkleRoot).to.equal(root);
    } catch {
      logger.error({
        msg: 'calculate root failed',
        leaves,
        leafCount: leaves.length,
        rootCalculatedOffChain: root,
        rootCalculatedOnChain: merkleRoot,
      });
      expect.fail();
    }
  }

  function generateRandomLeaves(length) {
    return Array.from({ length }, () =>
      poseidonHash([generalise(Math.round(Math.random() * 2 ** 32))]).hex(32),
    );
  }

  async function updateAndVerifyFrontier(oldLeaves, newLeaves) {
    const emptyTree = new Timber({
      root: 0,
      frontier: [],
      leafCount: 0,
      tree: undefined,
      hashType: HASH_TYPE,
      height: TIMBER_HEIGHT,
    });
    let updatedTimber = Timber.statelessUpdate(emptyTree, oldLeaves, HASH_TYPE, TIMBER_HEIGHT);
    const { frontier: oldFrontier, leafCount: oldLeafCount } = updatedTimber;
    const frontierBeforeBlocks = oldFrontier.concat(
      Array(33 - oldFrontier.length).fill(ethers.constants.HashZero),
    );

    updatedTimber = Timber.statelessUpdate(updatedTimber, newLeaves, HASH_TYPE, TIMBER_HEIGHT);
    const { frontier } = updatedTimber;

    const merkleFrontier = await merkleTreeMock.callStatic.updateFrontier(
      newLeaves,
      frontierBeforeBlocks,
      oldLeafCount,
    );

    for (const [index, front] of merkleFrontier.entries()) {
      if (front !== ethers.constants.HashZero) {
        try {
          expect(front).to.be.eq(frontier[index]);
        } catch {
          logger.error({
            msg: 'update frontier failed',
            oldLeaves,
            newLeaves,
            oldLeafCount: oldLeaves.length,
            newLeafCount: newLeaves.length,
            updatedFrontierOffChain: frontier,
            updatedFrontierOnChain: merkleFrontier,
            index,
          });
          expect.fail();
        }
      }
    }
  }

  beforeEach(async () => {
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
    const MerkleTreeMock = await ethers.getContractFactory('MerkleTree_StatelessMock', {
      libraries: {
        MerkleTree_Stateless: merkleTree.address,
      },
    });
    merkleTreeMock = await MerkleTreeMock.deploy();
    await merkleTreeMock.deployed();
  });

  afterEach(async () => {
    // clear down the test network after each test
    await hardhat.network.provider.send('hardhat_reset');
  });

  it('calculate root of a tree with one leaf', async () => {
    const leaves = generateRandomLeaves(1);
    await calculateAndVerifyRoot(leaves);
  });

  it('calculate root of a tree with two leaves', async () => {
    const leaves = generateRandomLeaves(2);
    await calculateAndVerifyRoot(leaves);
  });

  it('calculate root of a tree with three leaves', async () => {
    const leaves = generateRandomLeaves(3);
    await calculateAndVerifyRoot(leaves);
  });

  it('calculate root of a tree with four leaves', async () => {
    const leaves = generateRandomLeaves(4);
    await calculateAndVerifyRoot(leaves);
  });
  it('calculate root of a tree with five leaves', async () => {
    const leaves = generateRandomLeaves(5);
    await calculateAndVerifyRoot(leaves);
  });
  it('calculate root of a tree with six leaves', async () => {
    const leaves = generateRandomLeaves(6);
    await calculateAndVerifyRoot(leaves);
  });
  it('calculate root of a tree with seven leaves', async () => {
    const leaves = generateRandomLeaves(7);
    await calculateAndVerifyRoot(leaves);
  });

  it('calculate root of with random amount of leaves', async () => {
    const leafCount1 = Math.round(Math.random() * 2 ** 12);
    const leaves1 = generateRandomLeaves(leafCount1);
    await calculateAndVerifyRoot(leaves1);

    const leafCount2 = Math.round(Math.random() * 2 ** 12);
    const leaves2 = generateRandomLeaves(leafCount2);
    await calculateAndVerifyRoot(leaves2);

    const leafCount3 = Math.round(Math.random() * 2 ** 12);
    const leaves3 = generateRandomLeaves(leafCount3);
    await calculateAndVerifyRoot(leaves3);
  });

  it('update frontier with one oldLeaf and no newLeaves', async () => {
    const oldLeaves = generateRandomLeaves(1);
    const newLeaves = generateRandomLeaves(0);
    await updateAndVerifyFrontier(oldLeaves, newLeaves);
  });

  it('update frontier with no oldLeaf and one newLeaves', async () => {
    const oldLeaves = generateRandomLeaves(0);
    const newLeaves = generateRandomLeaves(1);
    await updateAndVerifyFrontier(oldLeaves, newLeaves);
  });

  it('update frontier with one oldLeaf and one newLeaves', async () => {
    const oldLeaves = generateRandomLeaves(1);
    const newLeaves = generateRandomLeaves(1);
    await updateAndVerifyFrontier(oldLeaves, newLeaves);
  });

  it('update frontier with random oldLeaves length and newLeaves length', async () => {
    const oldLeaves1 = generateRandomLeaves(Math.round(Math.random() * 2 ** 12));
    const newLeaves1 = generateRandomLeaves(Math.round(Math.random() * 2 ** 6));
    await updateAndVerifyFrontier(oldLeaves1, newLeaves1);

    const oldLeaves2 = generateRandomLeaves(Math.round(Math.random() * 2 ** 12));
    const newLeaves2 = generateRandomLeaves(Math.round(Math.random() * 2 ** 6));
    await updateAndVerifyFrontier(oldLeaves2, newLeaves2);

    const oldLeaves3 = generateRandomLeaves(Math.round(Math.random() * 2 ** 12));
    const newLeaves3 = generateRandomLeaves(Math.round(Math.random() * 2 ** 6));
    await updateAndVerifyFrontier(oldLeaves3, newLeaves3);
  });
});
