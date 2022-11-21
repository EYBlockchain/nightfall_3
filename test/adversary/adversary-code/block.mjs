/* ignore unused exports */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const incorrectLeafCount = block => {
  logger.debug('Creating Incorrect Leaf Count');
  logger.debug({ msg: 'Block before modification', block });
  // eslint-disable-next-line no-param-reassign
  block.leafCount = Math.floor(Math.random() * 2 ** 16);
  logger.debug({ msg: 'Block after modification', block });
  return block;
};

const incorrectTreeRoot = block => {
  logger.debug('Creating Incorrect Tree Root');
  logger.debug({ msg: 'Block before modification', block });
  // eslint-disable-next-line no-param-reassign
  block.root = `0x${BigInt(Math.floor(Math.random() * 2 ** 64))
    .toString(16)
    .padStart(64, '0')}`;
  logger.debug({ msg: 'Block after modification', block });
  return block;
};

const incorrectFrontierHash = block => {
  logger.debug('Creating Incorrect Frontier');
  logger.debug({ msg: 'Block before modification', block });
  // eslint-disable-next-line no-param-reassign
  block.frontier = [
    `0x${BigInt(Math.floor(Math.random() * 2 ** 64))
      .toString(16)
      .padStart(64, '0')}`,
  ];
  logger.debug({ msg: 'Block after modification', block });
  return block;
};

// eslint-disable-next-line import/prefer-default-export
export const createBadBlock = (block, badTxType) => {
  logger.debug(`Creating a block of type ${badTxType}`);
  switch (badTxType) {
    case 'IncorrectTreeRoot':
      return incorrectTreeRoot(block);
    case 'IncorrectLeafCount':
      return incorrectLeafCount(block);
    case 'IncorrectFrontierHash':
      return incorrectFrontierHash(block);
    default:
      return block;
  }
};
