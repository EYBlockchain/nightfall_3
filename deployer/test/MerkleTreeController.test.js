/**
@author iAmMichaelConnor
*/

import assert from 'assert';
import config from 'config';

import Web3 from '../src/web3';
import utilsWeb3 from '../src/utils-web3';

import deployer from './rest/deployer';

const web3 = Web3.connect();

let contractInstance;

let coinbase;

const n = 100;

describe('MerkleTreeController', async () => {
  before('get contractInstance', async () => {
    if (!(await Web3.isConnected())) await Web3.connection();

    coinbase = await web3.eth.getCoinbase();

    contractInstance = await deployer.getContractInstance(config.contract.name);
    // console.log('contractInstance', contractInstance);
  });

  // eslint-disable-next-line func-names
  describe(`adding leaves via MerkleTreeController`, async function() {
    this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!

    const gasUsedArray = [];
    let totalGasUsed = 0;
    let averageGasUsed = 0;
    let averageGasUsedMinusTxCost = 0;
    let max = 0;
    let min = 100000000;
    let range;

    it(`adds one leaf at a time correctly`, async () => {
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
            // const { leafIndex, root } = receipt.events.newLeaf.returnValues;
            // console.log(leafIndex, root);
          });

        const { gasUsed } = txReceipt;
        gasUsedArray.push(gasUsed);
      }
    });

    after('provide summary stats', async () => {
      totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
      max = Math.max(...gasUsedArray);
      min = Math.min(...gasUsedArray);
      averageGasUsed = totalGasUsed / n;
      averageGasUsedMinusTxCost = averageGasUsed - 20000;
      range = max - min;
      console.log('gasUsedArray:');
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

// // This is only a few hundred gas cheaper than calling from the derived contract MerkleTreeController, so we'll comment it out for now.
// describe('MerkleTree', async () => {
//   before('deploy contract', async () => {
//     await deployContract();
//   });
//
//   // eslint-disable-next-line func-names
//   describe(`adding leaves directly via updatePathToRoot`, async function() {
//     this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!
//
//     const gasUsedArray = [];
//     let totalGasUsed = 0;
//     let averageGasUsed = 0;
//     let averageGasUsedMinusTxCost = 0;
//     let max = 0;
//     let min = 100000000;
//     let range;
//
//     it(`adds leaves`, async () => {
//       for (let i = 0; i < n; i += 1) {
//         // eslint-disable-next-line no-await-in-loop
//         const txReceipt = await contractInstance.methods
//           .updatePathToRoot(`0x${i}`)
//           .send({
//             from: coinbase,
//             gas: config.web3.options.defaultGas,
//             gasPrice: config.web3.options.defaultGasPrice,
//           })
//           // eslint-disable-next-line no-loop-func
//           .on('receipt', receipt => {
//             // const { leafIndex, root } = receipt.events.newLeaf.returnValues;
//             // console.log(leafIndex, root);
//           });
//
//         const { gasUsed } = txReceipt;
//         gasUsedArray.push(gasUsed);
//       }
//     });
//
//     after('provide summary stats', async () => {
//       totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
//       max = Math.max(...gasUsedArray);
//       min = Math.min(...gasUsedArray);
//       averageGasUsed = totalGasUsed / n;
//       averageGasUsedMinusTxCost = averageGasUsed - 20000;
//       range = max - min;
//       console.log('gasUsedArray:');
//       console.dir(gasUsedArray, { maxArrayLength: null });
//       console.log('totalGasUsed:', totalGasUsed);
//       console.log('averageGasUsed:', averageGasUsed);
//       console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
//       console.log('min:', min);
//       console.log('max:', max);
//       console.log('range:', range);
//     });
//   });
// });

// // This earlier version I wrote was used to inspire the more robust MerkleTree.sol which now exists. Commented out, because deprecated.
// describe('MerkleTree Original', async () => {
//   before('deploy contract', async () => {
//     await deployContract();
//   });
//
//   // eslint-disable-next-line func-names
//   describe(`adding leaves directly via updatePathToRootOriginal`, async function() {
//     this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!
//
//     const gasUsedArray = [];
//     let totalGasUsed = 0;
//     let averageGasUsed = 0;
//     let averageGasUsedMinusTxCost = 0;
//     let max = 0;
//     let min = 100000000;
//     let range;
//
//     it(`adds leaves`, async () => {
//       for (let i = 0; i < n; i += 1) {
//         // eslint-disable-next-line no-await-in-loop
//         const txReceipt = await contractInstance.methods
//           .updatePathToRootOriginal(`0x${i}`)
//           .send({
//             from: coinbase,
//             gas: config.web3.options.defaultGas,
//             gasPrice: config.web3.options.defaultGasPrice,
//           })
//           // eslint-disable-next-line no-loop-func
//           .on('receipt', receipt => {
//             // console.log(`receipt\n`, receipt);
//             const { leafIndex, leafValue, root } = receipt.events.newLeaf.returnValues;
//             // console.log(`events`, events);
//             // console.log('events.newLeaf:', events.newLeaf);
//             // console.log('events.newLeaf.returnValues:', events.newLeaf.returnValues);
//             // console.log('events.newLeaf.raw:', events.newLeaf.raw);
//             console.log(leafIndex, root);
//           });
//
//         const { gasUsed } = txReceipt;
//         gasUsedArray.push(gasUsed);
//       }
//     });
//
//     after('provide summary stats', async () => {
//       totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
//       max = Math.max(...gasUsedArray);
//       min = Math.min(...gasUsedArray);
//       averageGasUsed = totalGasUsed / n;
//       averageGasUsedMinusTxCost = averageGasUsed - 20000;
//       range = max - min;
//       console.log('gasUsedArray:');
//       console.dir(gasUsedArray, { maxArrayLength: null });
//       console.log('totalGasUsed:', totalGasUsed);
//       console.log('averageGasUsed:', averageGasUsed);
//       console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
//       console.log('min:', min);
//       console.log('max:', max);
//       console.log('range:', range);
//     });
//   });
// });
