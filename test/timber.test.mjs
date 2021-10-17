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

const randomLeaves = fc.hexaString({ minLength: 2, maxLength: 2 }).map(h => `0x${h}`);

describe('Test Local timber', () => {
  // let generatedValues;
  // let timber;
  // beforeEach(() => {
  //   generatedValues = genLeafValues(3);
  //   timber = new Timber();
  //   timber.insertLeaves(generatedValues);
  // });
  describe('Check Tree Operations', () => {
    // it('Check all leaves inserted ', () => {
    //   fc.assert(
    //     fc.property(randomLeaves, leaves => {
    //       const timber = new Timber();
    //       timber.insertLeaves(leaves);
    //       expect(timber.toArray().filter(t => t !== 0)).to.eql(leaves);
    //       expect(timber.leafCount).to.equal(leaves.length);
    //     }),
    //     { numRuns: 10 },
    //   );
    // });
    // it('Check hashing of root', () => {
    //   fc.assert(
    //     fc.property(randomLeaves, leaves => {
    //       let leavesArr = leaves;
    //       const timber = new Timber();
    //       timber.insertLeaves(leavesArr);
    //       for (let i = 0; i < TIMBER_HEIGHT; i++) {
    //         leavesArr = leavesArr.length % 2 === 0 ? leavesArr : [...leavesArr, 0];
    //         // eslint-disable-next-line no-loop-func
    //         leavesArr = leavesArr.reduce((all, one, idx) => {
    //           const ch = Math.floor(idx / 2);
    //           // eslint-disable-next-line no-param-reassign
    //           all[ch] = [].concat(all[ch] || [], one);
    //           return all;
    //         }, []);
    //         leavesArr = leavesArr.map(a => utils.concatenateThenHash(...a));
    //       }
    //       expect(leavesArr[0]).to.equal(timber.root);
    //     }),
    //     { numRuns: 10 },
    //   );
    // });
    // it('Check Merkle Proof', () => {
    //   fc.assert(
    //     fc.property(randomLeaves, fc.nat(MAX_ARRAY - 1), (leaves, randomIndex) => {
    //       const timber = new Timber();
    //       timber.insertLeaves(leaves);
    //       const leafValue = leaves[randomIndex];
    //       const merklePath = timber.getMerklePath(leafValue);
    //       expect(Timber.verifyMerklePath(leafValue, timber.root, merklePath)).to.be.equal(true);
    //     }),
    //     { numRuns: 10 },
    //   );
    // });
    // it('Check Rollback', () => {
    //   fc.assert(
    //     fc.property(randomLeaves, fc.nat(MAX_ARRAY - 1), (leaves, rollbackLeaf) => {
    //       const timber = new Timber();
    //       timber.insertLeaves(leaves);
    //       const newTimber = new Timber();
    //       newTimber.insertLeaves(leaves.slice(0, rollbackLeaf));
    //       expect(timber.rollback(rollbackLeaf)).to.eql(newTimber);
    //     }),
    //     { numRuns: 10 },
    //   );
    // });
    it('Check even updateFrontier', () => {
      let count = 0;
      fc.assert(
        fc.property(
          fc.array(randomLeaves, { minLength: 1, maxLength: MAX_ARRAY }),
          fc.array(randomLeaves, { minLength: 1, maxLength: 32 }),
          (leaves, addedLeaves) => {
            console.log(`randomLeaves: ${leaves.length}`);
            console.log(`AddedLeaves: ${addedLeaves.length}`);
            const timber = new Timber();
            timber.insertLeaves(leaves);
            const newFrontier = Timber.updateFrontier(timber, addedLeaves);
            timber.insertLeaves(addedLeaves);
            expect(newFrontier.frontier).to.eql(timber.frontier);
            expect(newFrontier.leafCount).to.equal(timber.leafCount);
            console.log(`count: ${count}`);
            count++;
          },
        ),
        { numRuns: 100 },
      );
      // const extraLeaves = genLeafValues(2, 3);
      // const newFrontier = Timber.updateFrontier(timber, extraLeaves);
      // // console.log(`newFrontier: ${newFrontier.frontier}`);
      // timber.insertLeaves(extraLeaves);
      // // console.log(`timber.insertLeaves: ${timber.frontier}`);
      // expect(newFrontier.frontier).to.eql(timber.frontier);
      // expect(newFrontier.leafCount).to.equal(timber.leafCount);
    });
  });
});

// const t = new Timber();
// const leafVals = genLeafValues(2);
// t.insertLeaves(leafVals);
// const extraLeaves = genLeafValues(4, 2);
// const newFrontier = Timber.updateFrontier(t, extraLeaves);
// t.insertLeaves(extraLeaves)
// // const newT = Timber.updateFrontier(t, ['0x03']);
// console.log(newFrontier.frontier);
// console.log(t.frontier);
// console.log(newFrontier.leafCount);
// console.log(t.leafCount);
