/* ignore unused exports */

import gen from 'general-number';
import config from 'config';
import Web3 from './web3.mjs';
import constants from '../constants/index.mjs';
import logger from './logger.mjs';

const { generalise } = gen;
const { SIGNATURES, TIMBER_HEIGHT } = config;
const { ZERO } = constants;

// eslint-disable-next-line import/prefer-default-export
export function unpackBlockInfo(packedInfo) {
  const packedInfoHex = generalise(packedInfo).hex(32).slice(2);

  const leafCount = generalise(`0x${packedInfoHex.slice(0, 8)}`).hex(4);
  const blockNumberL2 = generalise(`0x${packedInfoHex.slice(8, 24)}`).hex(8);
  const proposer = generalise(`0x${packedInfoHex.slice(24, 64)}`).hex(20);

  return { leafCount, blockNumberL2, proposer };
}

export function packBlockInfo(leafCount, proposer, blockNumberL2) {
  const blockNumberL2Packed = generalise(blockNumberL2).hex(8).slice(2);
  const leafCountPacked = generalise(leafCount).hex(4).slice(2);
  const proposerPacked = generalise(proposer).hex(20).slice(2);

  const packedInfo = '0x'.concat(leafCountPacked, blockNumberL2Packed, proposerPacked);
  return packedInfo;
}

export function calcBlockHash(block) {
  const web3 = Web3.connection();
  const {
    proposer,
    root,
    leafCount,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  } = block;

  const packedInfo = packBlockInfo(leafCount, proposer, blockNumberL2);

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

  const packedInfo = packBlockInfo(leafCount, proposer, blockNumberL2);

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
  const web3 = Web3.connection();
  const encodedTransaction = web3.eth.abi.encodeParameter(
    `bytes32[${TIMBER_HEIGHT + 1}]`,
    frontierPadded,
  );
  return web3.utils.soliditySha3({
    t: 'bytes',
    v: encodedTransaction,
  });
}

export async function getTimeByBlock(txHash) {
  const web3 = Web3.connection();
  const blockN = await web3.eth.getTransaction(txHash);
  const blockData = await web3.eth.getBlock(blockN.blockNumber);

  return blockData.timestamp;
}
