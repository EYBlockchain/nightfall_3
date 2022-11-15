import Web3 from 'web3';
import config from 'config';
import gen from 'general-number';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

// These functions are called by static methods in the Block class but are sometimes needed when the rest
// of the block object isn't.  They can thus be called directly when instantiating the Block class
// would be problematic because of its reliance on the Optimist database.

const { SIGNATURES, TIMBER_HEIGHT } = config;
const { ZERO } = constants;
const { generalise } = gen;

export const packInfo = (blockNumberL2, leafCount, proposer) => {
  const blockNumberL2Packed = generalise(blockNumberL2).hex(8).slice(2);
  const leafCountPacked = generalise(leafCount).hex(4).slice(2);
  const proposerPacked = generalise(proposer).hex(20).slice(2);

  return '0x'.concat(leafCountPacked, blockNumberL2Packed, proposerPacked);
};

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

  const packedInfo = packInfo(blockNumberL2, leafCount, proposer);

  const blockArray = [packedInfo, root, previousBlockHash, frontierHash, transactionHashesRoot];

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

  const packedInfo = packInfo(blockNumberL2, leafCount, proposer);

  return {
    packedInfo,
    root,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  };
}

export function calculateFrontierHash(frontier) {
  const frontierPadded = frontier.concat(Array(TIMBER_HEIGHT + 1 - frontier.length).fill(ZERO));
  const web3 = new Web3();
  const encodedTransaction = web3.eth.abi.encodeParameter(
    `bytes32[${TIMBER_HEIGHT + 1}]`,
    frontierPadded,
  );
  return web3.utils.soliditySha3({
    t: 'bytes',
    v: encodedTransaction,
  });
}
