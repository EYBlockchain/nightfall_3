import Web3 from 'web3';
import config from 'config';

// These functions are called by static methods in the Block class but are sometimes needed when the rest
// of the block object isn't.  They can thus be called directly when instantiating the Block class
// would be problematic because of its reliance on the Optimist database.

const { SIGNATURES } = config;

export function calcBlockHash(block) {
  const web3 = new Web3();
  const { proposer, root, leafCount, blockNumberL2, previousBlockHash, transactionHashesRoot } =
    block;
  const blockArray = [
    leafCount,
    proposer,
    root,
    blockNumberL2,
    previousBlockHash,
    transactionHashesRoot,
  ];
  const encoded = web3.eth.abi.encodeParameters([SIGNATURES.BLOCK], [blockArray]);
  return web3.utils.soliditySha3({ t: 'bytes', v: encoded });
}
  º
// remove properties that do not get sent to the blockchain returning
// a new object (don't mutate the original)
export function buildBlockSolidityStruct(block) {
  const { proposer, root, leafCount, blockNumberL2, previousBlockHash, transactionHashesRoot } =
    block;
  return {
    leafCount: Number(leafCount),
    proposer,
    root,
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
    transactionHashesRoot,
  };
}
