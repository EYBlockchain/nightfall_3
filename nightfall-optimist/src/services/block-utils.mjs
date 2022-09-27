import Web3 from 'web3';
import config from 'config';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';

// These functions are called by static methods in the Block class but are sometimes needed when the rest
// of the block object isn't.  They can thus be called directly when instantiating the Block class
// would be problematic because of its reliance on the Optimist database.

const { SIGNATURES } = config;
const { ZERO } = constants;

export function calcBlockHash(block) {
  const web3 = new Web3();
  const {
    proposer,
    root,
    leafCount,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  } = block;
  const blockArray = [
    leafCount,
    proposer,
    root,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  ];

  logger.debug({
    msg: 'Encoding parameters',
    signaturesBlock: SIGNATURES.BLOCK,
    blockArray,
  });

  const encoded = web3.eth.abi.encodeParameters([SIGNATURES.BLOCK], [blockArray]);
  return web3.utils.soliditySha3({ t: 'bytes', v: encoded });
}

// remove properties that do not get sent to the blockchain returning
// a new object (don't mutate the original)
export function buildBlockSolidityStruct(block) {
  const {
    proposer,
    root,
    leafCount,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  } = block;
  return {
    leafCount: Number(leafCount),
    proposer,
    root,
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  };
}

export function calculateFrontierHash(frontier) {
  const frontierPadded = frontier.concat(Array(33 - frontier.length).fill(ZERO));
  const web3 = new Web3();
  const encodedTransaction = web3.eth.abi.encodeParameter('bytes32[33]', frontierPadded);
  return web3.utils.soliditySha3({
    t: 'bytes',
    v: encodedTransaction,
  });
}
