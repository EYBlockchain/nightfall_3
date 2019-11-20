/**
@author iAmMichaelConnor
*/

// import assert from 'assert';
import config from 'config';

import Web3 from '../src/web3';

import deployer from './rest/deployer';

const web3 = Web3.connect();

let contractName;
let contractInstance;
let coinbase;

const numberOfBatches = 1;

const batchSize = 10;

describe('MerkleTreeController', async () => {
  contractName = 'MerkleTreeController';

  before('get contractInstance', async () => {
    if (!(await Web3.isConnected())) await Web3.connection();

    coinbase = await web3.eth.getCoinbase();

    contractInstance = await deployer.getContractInstance(contractName);
  });

  // // eslint-disable-next-line func-names
  // describe(`adding leaves via MerkleTreeController`, async function() {
  //   this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!
  //
  //   const gasUsedArray = [];
  //   let totalGasUsed = 0;
  //   let averageGasUsed = 0;
  //   let averageGasUsedMinusTxCost = 0;
  //   let max = 0;
  //   let min = 100000000;
  //   let range;
  //
  //   it(`adds one leaf at a time correctly`, async () => {
  //     for (let i = 0; i < batchSize; i += 1) {
  //       // eslint-disable-next-line no-await-in-loop
  //       const txReceipt = await contractInstance.methods
  //         ._insertLeaf(`0x${i}`)
  //         .send({
  //           from: coinbase,
  //           gas: config.web3.options.defaultGas,
  //           gasPrice: config.web3.options.defaultGasPrice,
  //         })
  //         // eslint-disable-next-line no-loop-func
  //         .on('receipt', receipt => {
  //           const { leafIndex, leafValue, root } = receipt.events.newLeaf.returnValues;
  //           console.log('newLeaf event returnValues:', leafIndex, leafValue, root);
  //         });
  //
  //       const { gasUsed } = txReceipt;
  //       gasUsedArray.push(gasUsed);
  //     }
  //   });
  //
  //   after('provide summary stats', async () => {
  //     totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
  //     max = Math.max(...gasUsedArray);
  //     min = Math.min(...gasUsedArray);
  //     averageGasUsed = totalGasUsed / batchSize;
  //     averageGasUsedMinusTxCost = averageGasUsed - 21000;
  //     range = max - min;
  //     console.log('gasUsedArray:');
  //     console.dir(gasUsedArray, { maxArrayLength: null });
  //     console.log('totalGasUsed:', totalGasUsed);
  //     console.log('averageGasUsed:', averageGasUsed);
  //     console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
  //     console.log('min:', min);
  //     console.log('max:', max);
  //     console.log('range:', range);
  //   });
  // });
  //
  // // eslint-disable-next-line func-names
  // describe(`Adding ${batchSize} leaves at once`, async function() {
  //   this.timeout(3660000); // surprisingly, this.timeout() doesn't work inside an arrow function!
  //
  //   const gasUsedArray = [];
  //   let totalGasUsed = 0;
  //   let averageGasUsed = 0;
  //   let averageGasUsedMinusTxCost = 0;
  //
  //   it(`Adds the leaves`, async () => {
  //     // create the leafValues to add:
  //     const leaves = [];
  //     for (let i = 0; i < batchSize; i += 1) {
  //       leaves.push(`0x${i}`);
  //     }
  //     // eslint-disable-next-line no-await-in-loop
  //     const txReceipt = await contractInstance.methods
  //       ._insertLeaves(leaves)
  //       .send({
  //         from: coinbase,
  //         gas: 8000000, // explore a full block of gas being used
  //         gasPrice: config.web3.options.defaultGasPrice,
  //       })
  //       // eslint-disable-next-line no-loop-func
  //       .on('receipt', receipt => {
  //         const { minLeafIndex, leafValues, root } = receipt.events.newLeaves.returnValues;
  //
  //         console.log('newLeaves event returnValues:', minLeafIndex, leafValues, root);
  //
  //         console.dir(receipt.events, { depth: null });
  //       });
  //
  //     const { gasUsed } = txReceipt;
  //     gasUsedArray.push(gasUsed);
  //   });
  //
  //   after('provide summary stats', async () => {
  //     totalGasUsed = gasUsedArray.reduce((acc, cur) => acc + cur);
  //     averageGasUsed = totalGasUsed / batchSize;
  //     averageGasUsedMinusTxCost = (totalGasUsed - 21000) / batchSize;
  //     console.log('\ngasUsedArray:');
  //     console.dir(gasUsedArray, { maxArrayLength: null });
  //     console.log('totalGasUsed:', totalGasUsed);
  //     console.log('averageGasUsed:', averageGasUsed);
  //     console.log('averageGasUsedMinusTxCost:', averageGasUsedMinusTxCost);
  //   });
  // });

  // eslint-disable-next-line func-names, prettier/prettier
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
        leaves.push(`0x${i}`);
      }

      for (let i = 0; i < numberOfBatches; i++) {
        const leavesToInsert = leaves.slice(i * batchSize, (i + 1) * batchSize);
        // eslint-disable-next-line no-await-in-loop
        const txReceipt = await contractInstance.methods
          ._insertLeaves(leavesToInsert)
          .send({
            from: coinbase,
            gas: 8000000, // explore a full block of gas being used
            gasPrice: config.web3.options.defaultGasPrice,
          })
          // eslint-disable-next-line no-loop-func
          .on('receipt', receipt => {
            const { minLeafIndex, leafValues, root } = receipt.events.newLeaves.returnValues;

            console.log('newLeaves event returnValues:', minLeafIndex, leafValues, root);

            console.dir(receipt.events, { depth: null });
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
});

//

//

//

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
