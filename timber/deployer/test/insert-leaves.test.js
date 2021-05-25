/**
@author iAmMichaelConnor
*/
import config from 'config';
import crypto from 'crypto';

import Web3 from '../src/web3';

import contractDeployer from '../src/deployer';
import merkleTree from '../src/rest/merkle-tree';

const contractName = config.contractNames[0];

const numberOfBatches = 220;
const batchSize = 100000;

// const treeHeight = 22;

/**
function to generate a promise that resolves to a string of hex
@param {int} bytes - the number of bytes of hex that should be returned
*/
const rndHex = bytes => {
  const buf = crypto.randomBytes(bytes);
  return `0x${buf.toString('hex')}`;
};

beforeEach('Redeploy contract', async () => {
  if (!(await Web3.isConnected())) await Web3.connection();

  console.log(`\nDeploying ${contractName}`);
  await contractDeployer.deploy(contractName);
});

// eslint-disable-next-line func-names
describe(`Adding ${numberOfBatches * batchSize} leaves in batches of ${batchSize}`, async function() {
  this.timeout(10000000); // surprisingly, this.timeout() doesn't work inside an arrow function!

  // await merkleTree.insertTreeHeight(contractName, treeHeight);

  it(`Adds the leaves`, async () => {
    // create the leafValues to add:
    for (let i = 0; i < numberOfBatches; i += 1) {
      const leaves = [];
      for (let j = 0; j < batchSize; j += 1) {
        const leaf = {
          value: rndHex(32),
          leafIndex: i * batchSize + j,
          blockNumber: 0,
        };
        // give us some output data
        if ((i * batchSize + j) % 17687 === 0) console.log(leaf);
        leaves.push(leaf);
      }
      // eslint-disable-next-line no-await-in-loop
      await merkleTree.insertLeaves(contractName, leaves);
      // eslint-disable-next-line no-await-in-loop
      await merkleTree.update(contractName);
    }
  });
});
