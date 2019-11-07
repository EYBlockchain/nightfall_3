/**
@author iAmMichaelConnor
*/

import assert from 'assert';
import config from 'config';

import Web3 from '../src/web3';
import db from '../src/leveldb';
import utilsWeb3 from '../src/utils-web3';

import deployer from '../src/deployer';

const web3 = Web3.connect();

let contractInstance;

let coinbase;

const n = 50;

const deployContract = async () => {
  if (!(await Web3.isConnected())) await Web3.connection();

  coinbase = await web3.eth.getCoinbase();

  console.log('\nDEPLOYING!');

  await deployer.deploy();

  const contractName = config.contract.name;
  console.log('contractName', contractName);

  const contractAddress = await db.get(contractName);
  console.log('contractAddress', contractAddress);

  contractInstance = await utilsWeb3.getContractInstance(contractName, contractAddress);
};

describe('Deployment', async () => {
  before('\ndeploy contract', async () => {
    await deployContract();
  });

  it('test1', async () => {});

  it(`sets the contract's owner`, async () => {
    // console.log('HIIIII');
    // console.log(contractInstance);
    const _owner = await contractInstance.methods.owner().call(); // calls the implicit getter for the public variable
    const owner = await web3.eth.getCoinbase();
    console.log('_owner', _owner);
    console.log('owner', owner);
    assert.equal(_owner.toLowerCase(), owner.toLowerCase());
  });
});

describe('MerkleTreeController', async () => {
  let rootOneAtATime; // the root after adding the leaves one-at-a-time
  let rootBulk; // the root after adding the leaves (to a new instance of the tree) in bulk.

  // eslint-disable-next-line func-names
  describe(`adding ${n} leaves one-at-a-time`, async function() {
    before('\ndeploy contract', async () => {
      await deployContract();
    });

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
        // eslint-disable-next-line no-await-in-loop
        const txReceipt = await contractInstance.methods
          ._insertLeaf(`0x${i}`)
          .send({
            from: coinbase,
            gas: config.web3.options.defaultGas,
            gasPrice: config.web3.options.defaultGasPrice,
          })
          // eslint-disable-next-line no-loop-func
          .on('receipt', receipt => {
            const { leafIndex, leafValue, root } = receipt.events.newLeaf.returnValues;
            console.log(leafIndex, leafValue, root);

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
  describe(`Adding ${n} leaves at once`, async function() {
    before('deploy contract', async () => {
      await deployContract();
    });

    this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;

    it(`Adds the leaves`, async () => {
      // create the leafValues to add:
      const leaves = [];
      for (let i = 0; i < n; i += 1) {
        leaves.push(`0x${i}`);
      }
      // eslint-disable-next-line no-await-in-loop
      const txReceipt = await contractInstance.methods
        ._insertLeaves(leaves)
        .send({
          from: coinbase,
          gas: 8000000, // explore a full block of gas being used
          gasPrice: config.web3.options.defaultGasPrice,
        })
        // eslint-disable-next-line no-loop-func
        .on('receipt', receipt => {
          const { minLeafIndex, leafValues, root } = receipt.events.newLeaves.returnValues;
          console.log(minLeafIndex, leafValues, root);

          rootBulk = root; // will be used in a later test
        });

      const { gasUsed } = txReceipt;
      gasUsedArray.push(gasUsed);
    });

    after('provide summary stats', async () => {
      totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
      averageGasUsed = totalGasUsed / n;
      averageGasUsedMinusTxCost = (totalGasUsed - 21000) / n;
      console.log('\ngasUsedArray:');
      console.dir(gasUsedArray, { maxArrayLength: null });
      console.log('totalGasUsed:', totalGasUsed);
      console.log('averageGasUsed:', averageGasUsed);
      console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
    });
  });

  // eslint-disable-next-line func-names
  describe(`Having added ${n} leaves in two different ways...`, async function() {
    it(`Should yield the same merkle root both times`, async () => {
      console.log('rootOneAtATime', rootOneAtATime);
      console.log('rootBulk', rootBulk);
      assert.equal(rootOneAtATime, rootBulk);
    });
  });
});
