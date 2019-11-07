/*
Execute this from the command line:
cd path/to/src
npx babel-node console-testing
*/

import utilsMT from './utils-merkle-tree';

// console.log(utilsMT.rightChildBinaryIndex(0b11).toString(2));

// console.log(utilsMT.getSiblingPathIndices('50'));

// console.log(utilsMT.testMerkleRecursion(0));

async function main() {
  // console.log(await utilsMT.testMerkleRecursionAsync(0));
  // console.log(utilsMT.testMerkleRecursion(0));
  // console.log(utilsMT.testMerkleIteration());
  console.log(utilsMT.loopNumberOfHashes(4, 6));
  // console.log(utilsMT.numberOfHashes(2 ** 31, 5, 32));
}

main();
