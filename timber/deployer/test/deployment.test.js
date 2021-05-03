/**
@author iAmMichaelConnor
*/

import assert from 'assert';
import config from 'config';

import Web3 from '../src/web3';

import contractDeployer from '../src/deployer';

const web3 = Web3.connect();

const contractName = config.contractNames[0];
let contractInstance;
let coinbase;

const numberOfBatches = 1;
const batchSize = 10;

const n = 10;

beforeEach('Redeploy contract', async () => {
  if (!(await Web3.isConnected())) await Web3.connection();

  coinbase = await web3.eth.getCoinbase();

  console.log(`\nDeploying ${contractName}`);
  contractInstance = await contractDeployer.deploy(contractName);
});

describe('Deployment', async () => {
  it(`sets the contract's owner`, async () => {
    const _owner = await contractInstance.methods.owner().call(); // calls the implicit getter for the public variable
    const owner = await web3.eth.getCoinbase();
    console.log('_owner', _owner);
    console.log('owner', owner);
    assert.equal(_owner.toLowerCase(), owner.toLowerCase());
  });
});

describe('Main test', async () => {
  let rootOneAtATime; // the root after adding the leaves one-at-a-time
  let rootBulk; // the root after adding the leaves (to a new instance of the tree) in bulk.

  // eslint-disable-next-line func-names
  describe(`adding ${n} leaves one-at-a-time`, async function() {
    this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;
    let max = 0;
    let min = 100000000;
    let range;

    it(`adds the leaves`, async () => {
      for (let i = 0; i < n; i += 1) {
        const leaf = i.toString().padStart(64, '0'); // pad to 32 bytes

        // eslint-disable-next-line no-await-in-loop
        const txReceipt = await contractInstance.methods
          ._insertLeaf(`0x${leaf}`)
          .send({
            from: coinbase,
            gas: config.web3.options.defaultGas,
            gasPrice: config.web3.options.defaultGasPrice,
          })
          // eslint-disable-next-line no-loop-func
          .on('receipt', receipt => {
            const { leafIndex, leafValue, root } = receipt.events.NewLeaf.returnValues;
            console.log('NewLeaf:', leafIndex, leafValue, root);

            rootOneAtATime = root; // will be used in a later test
          });

        const { gasUsed } = txReceipt;
        gasUsedArray.push(gasUsed);
      }
    });

    after('\nprovide summary stats', async () => {
      totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
      max = Math.max(...gasUsedArray);
      min = Math.min(...gasUsedArray);
      averageGasUsed = totalGasUsed / n;
      averageGasUsedMinusTxCost = averageGasUsed - 21000;
      range = max - min;
      console.log('\ngasUsedArray:');
      console.dir(gasUsedArray, { maxArrayLength: null });
      console.log('totalGasUsed:', totalGasUsed);
      console.log('averageGasUsed:', averageGasUsed);
      console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
      console.log('min:', min);
      console.log('max:', max);
      console.log('range:', range);
    });
  });

  // eslint-disable-next-line func-names
  describe(`Adding ${batchSize} leaves at once`, async function() {
    this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;

    it(`Adds the leaves`, async () => {
      // create the leafValues to add:
      const leaves = [];
      for (let i = 0; i < batchSize; i += 1) {
        const leaf = i.toString().padStart(64, '0'); // pad to 32 bytes
        leaves.push(`0x${leaf}`);
      }
      // eslint-disable-next-line no-await-in-loop
      const txReceipt = await contractInstance.methods
        ._insertLeaves(leaves)
        .send({
          from: coinbase,
          gas: 10000000, // explore a full block of gas being used
          gasPrice: config.web3.options.defaultGasPrice,
        })
        // eslint-disable-next-line no-loop-func
        .on('receipt', receipt => {
          const { minLeafIndex, leafValues, root } = receipt.events.NewLeaves.returnValues;
          console.log(minLeafIndex, leafValues, root);

          rootBulk = root; // will be used in a later test
        });

      const { gasUsed } = txReceipt;
      gasUsedArray.push(gasUsed);
    });

    after('provide summary stats', async () => {
      totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
      averageGasUsed = totalGasUsed / batchSize;
      averageGasUsedMinusTxCost = (totalGasUsed - 21000) / batchSize;
      console.log('\ngasUsedArray:');
      console.dir(gasUsedArray, { maxArrayLength: null });
      console.log('totalGasUsed:', totalGasUsed);
      console.log('averageGasUsed:', averageGasUsed);
      console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
    });
  });

  // eslint-disable-next-line func-names
  describe(`Adding ${numberOfBatches * batchSize} leaves in batches of ${batchSize}`, async function() {
    this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

    const numberOfLeaves = numberOfBatches * batchSize;
    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;

    it(`Adds the leaves`, async () => {
      // create the leafValues to add:
      const leaves = [];
      for (let i = 0; i < numberOfLeaves; i += 1) {
        const leaf = i.toString().padStart(64, '0'); // pad to 32 bytes
        leaves.push(`0x${leaf}`);
      }

      for (let i = 0; i < numberOfBatches; i++) {
        const leavesToInsert = leaves.slice(i * batchSize, (i + 1) * batchSize);
        // eslint-disable-next-line no-await-in-loop
        const txReceipt = await contractInstance.methods
          ._insertLeaves(leavesToInsert)
          .send({
            from: coinbase,
            gas: 10000000, // explore a full block of gas being used
            gasPrice: config.web3.options.defaultGasPrice,
          })
          // eslint-disable-next-line no-loop-func
          .on('receipt', receipt => {
            const { minLeafIndex, leafValues, root } = receipt.events.NewLeaves.returnValues;

            console.log('NewLeaves event returnValues:', minLeafIndex, leafValues, root);

            // console.dir(receipt.events, { depth: null });
          });

        const { gasUsed } = txReceipt;
        gasUsedArray.push(gasUsed);
      }
    });

    after('provide summary stats', async () => {
      totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
      averageGasUsed = totalGasUsed / batchSize;
      averageGasUsedMinusTxCost = (totalGasUsed - 21000) / batchSize;
      console.log('\ngasUsedArray:');
      console.dir(gasUsedArray, { maxArrayLength: null });
      console.log('totalGasUsed:', totalGasUsed);
      console.log('averageGasUsed:', averageGasUsed);
      console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
    });
  });

  // eslint-disable-next-line func-names
  describe(`Having added ${batchSize} leaves in two different ways...`, async function() {
    it(`Should yield the same merkle root both times`, async () => {
      console.log('rootOneAtATime', rootOneAtATime);
      console.log('rootBulk', rootBulk);
      assert.equal(rootOneAtATime, rootBulk);
    });
  });
});
