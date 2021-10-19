import config from 'config';
import chai from 'chai';
import fc from 'fast-check';
import Timber from '../common-files/classes/timber.mjs';
import utils from '../common-files/utils/crypto/merkle-tree/utils.mjs';

const { expect } = chai;
const { TIMBER_HEIGHT } = config;

const genLeafValues = (n, start = 0) => {
  const arrayOfVals = [...Array(n).keys()].map(s => s + (start + 1));
  const maxPad = Math.ceil(Math.log10(n)) + 1;
  const paddedVals = arrayOfVals.map(a => `0x${a.toString().padStart(maxPad, '0')}`);
  return paddedVals;
};

const MAX_ARRAY = 100;

const randomLeaf = fc.hexaString({ minLength: 8, maxLength: 8 }).map(h => `0x${h}`);

describe('Test Local timber', () => {
  describe('Check Tree Operations', () => {
    it('Check all leaves inserted ', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY }), leaves => {
          const timber = new Timber();
          timber.insertLeaves(leaves);
          expect(timber.toArray().filter(t => t !== 0)).to.eql(leaves);
          expect(timber.leafCount).to.equal(leaves.length);
        }),
        { numRuns: 5 },
      );
    });
    it('Check hashing of root', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY }), leaves => {
          let leavesArr = leaves;
          const timber = new Timber();
          timber.insertLeaves(leavesArr);
          for (let i = 0; i < TIMBER_HEIGHT; i++) {
            leavesArr = leavesArr.length % 2 === 0 ? leavesArr : [...leavesArr, 0];
            // eslint-disable-next-line no-loop-func
            leavesArr = leavesArr.reduce((all, one, idx) => {
              const ch = Math.floor(idx / 2);
              // eslint-disable-next-line no-param-reassign
              all[ch] = [].concat(all[ch] || [], one);
              return all;
            }, []);
            leavesArr = leavesArr.map(a => utils.concatenateThenHash(...a));
          }
          expect(leavesArr[0]).to.equal(timber.root);
        }),
        { numRuns: 5 },
      );
    });
    it('Check Merkle Proof', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY }), leaves => {
          const timber = new Timber();
          timber.insertLeaves(leaves);
          const randomIndex = Math.floor(Math.random() * (leaves.length - 1));
          const leafValue = leaves[randomIndex];
          const merklePath = timber.getMerklePath(leafValue);
          expect(Timber.verifyMerklePath(leafValue, timber.root, merklePath)).to.be.equal(true);
        }),
        { numRuns: 5 },
      );
    });
    it('Check Rollback', () => {
      fc.assert(
        fc.property(fc.array(randomLeaf, { minLength: 1, maxLength: MAX_ARRAY }), leaves => {
          const timber = new Timber();
          timber.insertLeaves(leaves);
          const newTimber = new Timber();
          const rollbackLeaf = Math.max(1,Math.floor(Math.random() * (leaves.length - 1))); //Check this
          newTimber.insertLeaves(leaves.slice(0, rollbackLeaf));
          expect(timber.rollback(rollbackLeaf)).to.eql(newTimber);
        }),
        { numRuns: 5 },
      );
    });
  });
  describe('Check Frontier-based Operations', () => {
    it('Check updateFrontier', () => {
      let count = 0;
      fc.assert(
        fc.property(
          fc.array(randomLeaf, { minLength: 0, maxLength: MAX_ARRAY }), // Remove Duplicates within both arrays
          fc.array(randomLeaf, { minLength: 1, maxLength: 32 }), // // Remove Duplicates within both arrays
          (leaves, addedLeaves) => {
            const timber = new Timber();
            timber.insertLeaves(leaves);
            const newFrontier = Timber.updateFrontier(timber, addedLeaves);
            timber.insertLeaves(addedLeaves);
            // console.log(`Timber post-insert root:${timber.root}`);
            // console.log(timber.toArray());
            expect(newFrontier.frontier).to.eql(timber.frontier);
            expect(newFrontier.leafCount).to.equal(timber.leafCount);
            expect(newFrontier.root).to.equal(timber.root);
            console.log(`count: ${count}`);
            count++;
          },
        ),
        { numRuns: 10 },
      );
    });
  });
});

// const t = new Timber();
// const leafVals = genLeafValues(31);
// t.insertLeaves(leafVals);
// const extraLeaves = genLeafValues(1, 31);
// const newFrontier = Timber.updateFrontier(t, extraLeaves);
// t.insertLeaves(extraLeaves)
// console.log(newFrontier.root);
// console.log(t.root);
