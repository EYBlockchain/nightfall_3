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

const n = 10;

const insertLeavesBatchSizes = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  32,
  64,
  128,
  256,
  512,
  1024,
];

beforeEach('Redeploy contract', async () => {
  if (!(await Web3.isConnected())) await Web3.connection();

  coinbase = await web3.eth.getCoinbase();

  console.log(`\nDeploying ${contractName}`);
  contractInstance = await contractDeployer.deploy(contractName);
});

describe('insertLeaf', async () => {
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
});

describe('insertLeaves', async () => {
  for (let j = 0; j < insertLeavesBatchSizes.length; j++) {
    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;

    const batchSize = insertLeavesBatchSizes[j];
    // eslint-disable-next-line func-names, no-loop-func
    describe(`insertLeaves batch size ${batchSize}`, async function() {
      this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

      // eslint-disable-next-line no-loop-func
      it(`inserts ${batchSize} leaves at once`, async () => {
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
            // console.log(minLeafIndex, leafValues, root);
          });

        const { gasUsed } = txReceipt;
        gasUsedArray.push(gasUsed);
      });

      // eslint-disable-next-line no-loop-func
      after(`provide summary stats for batch size ${batchSize}:`, async () => {
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
  }
});
