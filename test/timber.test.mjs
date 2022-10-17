import chai from 'chai';
import fc from 'fast-check';
import Timber from '@polygon-nightfall/common-files/classes/timber.mjs';
import utils from '@polygon-nightfall/common-files/utils/crypto/merkle-tree/utils.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { expect } = chai;
const TIMBER_HEIGHT = 5;
const HASH_TYPE = 'keccak256'; // 'poseidon', 'mimc', 'sha256'
const { ZERO } = constants;

// Old way to generate leaf values, now we use fast-check
// const genLeafValues = (n, start = 0) => {
//   const arrayOfVals = [...Array(n).keys()].map(s => s + (start + 1));
//   const maxPad = Math.ceil(Math.log10(n)) + 1;
//   const paddedVals = arrayOfVals.map(a => `0x${a.toString().padStart(maxPad, ZERO)}`);
//   return paddedVals;
// };

// This runs standard mocha tests but using randomly generated inputs.
const MAX_ARRAY_1 = TIMBER_HEIGHT > 5 ? 100 : 16;
const MAX_ARRAY_2 = TIMBER_HEIGHT > 5 ? 32 : 8;

const randomLeaf = fc.hexaString({ minLength: 64, maxLength: 64 }).map(h => `0x${h}`);

describe('Local Timber Tests', () => {
  describe('Check Tree Operations', () => {
    it('Check all leaves inserted ', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY_1 }), leaves => {
          const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
          timber.insertLeaves(leaves);
          expect(timber.toArray().filter(t => t !== ZERO)).to.eql(leaves);
          expect(timber.leafCount).to.equal(leaves.length);
        }),
        { numRuns: 5 },
      );
    });
    it('Check hashing of root', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_1 }), leaves => {
          let leavesArr = leaves;
          const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
          timber.insertLeaves(leavesArr);
          for (let i = 0; i < TIMBER_HEIGHT; i++) {
            leavesArr = leavesArr.length % 2 === 0 ? leavesArr : [...leavesArr, ZERO];
            // eslint-disable-next-line no-loop-func
            leavesArr = leavesArr.reduce((all, one, idx) => {
              const ch = Math.floor(idx / 2);
              // eslint-disable-next-line no-param-reassign
              all[ch] = [].concat(all[ch] || [], one);
              return all;
            }, []);
            leavesArr = leavesArr.map(a => utils.concatenateThenHash(HASH_TYPE, ...a));
          }
          expect(leavesArr[0]).to.equal(timber.root);
        }),
        { numRuns: 5 },
      );
    });
    it('Check Merkle Proof', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_1 }), leaves => {
          const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
          timber.insertLeaves(leaves);
          const randomIndex = Math.floor(Math.random() * (leaves.length - 1));
          const leafValue = leaves[randomIndex];
          const merklePath = timber.getSiblingPath(leafValue);
          expect(
            Timber.verifySiblingPath(leafValue, timber.root, merklePath, HASH_TYPE),
          ).to.be.equal(true);
        }),
        { numRuns: 5 },
      );
    });
    it('Check Rollback', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_1 }), leaves => {
          const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
          timber.insertLeaves(leaves);
          const newTimber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
          const rollbackLeaf = Math.max(1, Math.floor(Math.random() * (leaves.length - 1)));
          newTimber.insertLeaves(leaves.slice(0, rollbackLeaf));
          expect(timber.rollback(rollbackLeaf)).to.eql(newTimber);
        }),
        { numRuns: 5 },
      );
    });
  });
  describe('Check Frontier-based Operations', () => {
    it('Check updateFrontier', () => {
      fc.assert(
        fc.property(
          fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY_1 }), // Remove Duplicates within both arrays
          fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY_2 }), // Remove Duplicates within both arrays
          (leaves, addedLeaves) => {
            const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT);
            timber.insertLeaves(leaves);
            const newFrontier = Timber.statelessUpdate(
              timber,
              addedLeaves,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );
            timber.insertLeaves(addedLeaves);
            expect(newFrontier.frontier).to.eql(timber.frontier);
            expect(newFrontier.leafCount).to.equal(timber.leafCount);
            expect(newFrontier.root).to.equal(timber.root);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('Check stateless Merkle Paths', () => {
      fc.assert(
        fc.property(
          fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY_1 }),
          fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_2 }),
          (leaves, addedLeaves) => {
            const leafIndex = Math.max(0, Math.floor(Math.random() * (addedLeaves.length - 1)));
            const leafValue = addedLeaves[leafIndex];
            const initialTimber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT).insertLeaves(
              leaves,
            );
            const statelessMerklePath = Timber.statelessSiblingPath(
              initialTimber,
              addedLeaves,
              leafIndex,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );
            const statelessUpdate = Timber.statelessUpdate(
              initialTimber,
              addedLeaves,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );

            const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT).insertLeaves(
              leaves.concat(addedLeaves),
            );
            const timberMerklePath = timber.getSiblingPath(leafValue);

            expect(statelessUpdate.root).to.equal(timber.root);
            expect(statelessUpdate.frontier).to.eql(timber.frontier);
            expect(statelessUpdate.leafCount).to.equal(timber.leafCount);
            expect(statelessMerklePath).to.eql(timberMerklePath);

            if (timberMerklePath.isMember) {
              expect(
                Timber.verifySiblingPath(
                  leafValue,
                  statelessUpdate.root,
                  statelessMerklePath,
                  HASH_TYPE,
                ),
              ).to.eql(true);
              expect(
                Timber.verifySiblingPath(leafValue, timber.root, timberMerklePath, HASH_TYPE),
              ).to.eql(true);
            }
          },
        ),
        { numRuns: 20 },
      );
    });
    it.skip('Check Sibling Path Increment', () => {
      fc.assert(
        fc.property(
          fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY_1 }), // Remove Duplicates within both arrays
          fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_2 }), // Remove Duplicates within both arrays
          fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY_2 }), // Remove Duplicates within both arrays
          (leaves, addedLeaves, yetMoreLeaves) => {
            const leafIndex = Math.max(0, Math.floor(Math.random() * (addedLeaves.length - 1)));
            const leafValue = addedLeaves[leafIndex];
            const initialTimber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT).insertLeaves(
              leaves,
            );
            // Get a sibling path after new leaves are added
            const statelessMerklePath = Timber.statelessSiblingPath(
              initialTimber,
              addedLeaves,
              leafIndex,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );
            // Update Timber statelessly (no tree)
            const statelessUpdate = Timber.statelessUpdate(
              initialTimber,
              addedLeaves,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );
            // Given the new state (sans tree), try to increment the sibling path
            const statelessIncrementPath = Timber.statelessIncrementSiblingPath(
              statelessUpdate,
              yetMoreLeaves,
              leaves.length + leafIndex,
              leafValue,
              statelessMerklePath,
              HASH_TYPE,
              TIMBER_HEIGHT,
            );
            const timber = new Timber(...[, , , ,], HASH_TYPE, TIMBER_HEIGHT).insertLeaves(
              leaves.concat(addedLeaves).concat(yetMoreLeaves),
            );
            const timberMerklePath = timber.getSiblingPath(leafValue);
            if (statelessIncrementPath.isMember) {
              expect(
                Timber.verifySiblingPath(leafValue, timber.root, statelessIncrementPath),
                HASH_TYPE,
              ).to.eql(true);
              expect(
                Timber.verifySiblingPath(leafValue, timber.root, timberMerklePath, HASH_TYPE),
              ).to.eql(true);
            }
            expect(statelessIncrementPath.path).to.have.deep.members(timberMerklePath.path);
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
