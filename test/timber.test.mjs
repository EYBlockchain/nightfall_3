import config from 'config';
import chai from 'chai';
import Timber from '../common-files/classes/timber.mjs';
import utils from '../common-files/utils/crypto/merkle-tree/utils.mjs';

const { expect } = chai;
const { TIMBER_HEIGHT, ZERO } = config;

const genLeafValues = n => {
  const arrayOfVals = [...Array(n).keys()].map(s => s + 1);
  const maxPad = Math.ceil(Math.log10(n)) + 1;
  const paddedVals = arrayOfVals.map(a => `0x${a.toString().padStart(maxPad, '0')}`);
  return paddedVals;
};

describe('Test Local timber', () => {
  let generatedValues;
  let timber;
  beforeEach(() => {
    generatedValues = genLeafValues(50);
    timber = new Timber();
    timber.insertLeaves(generatedValues);
  });
  describe('Check Tree Operations', () => {
    it('Check all leaves inserted ', () => {
      const timberArray = timber.toArray();
      expect(timberArray.filter(t => t !== ZERO)).to.eql(generatedValues);
    });
    it('Check hashing of root', () => {
      let arr = generatedValues;
      for (let i = 0; i < TIMBER_HEIGHT; i++) {
        arr = arr.length % 2 === 0 ? arr : [...arr, ZERO];
        // eslint-disable-next-line no-loop-func
        arr = arr.reduce((all, one, idx) => {
          const ch = Math.floor(idx / 2);
          // eslint-disable-next-line no-param-reassign
          all[ch] = [].concat(all[ch] || [], one);
          return all;
        }, []);
        arr = arr.map(a => utils.concatenateThenHash(...a));
      }
      expect(arr[0]).to.equal(timber.root);
    });
    it('Check leafCount', () => {
      expect(generatedValues.length).to.equal(timber.leafCount);
    });
    it('Check Merkle Proof', () => {
      const randomIndex = Math.floor(Math.random() * generatedValues.length);
      const leafValue = generatedValues[randomIndex];
      const merklePath = timber.getMerklePath(leafValue);
      expect(Timber.verifyMerklePath(leafValue, timber.root, merklePath)).to.be.equal(true);
    });
    it('Check Rollback', () => {
      const rollbackLeafTo = Math.floor(Math.random() * generatedValues.length);
      const newTimber = new Timber();
      newTimber.insertLeaves(generatedValues.slice(0, rollbackLeafTo));
      expect(timber.rollback(rollbackLeafTo)).to.eql(newTimber);
    });
  });
});
