/* ignore unused exports */
import logger from 'common-files/utils/logger.mjs';

const error = [/* 'IncorrectTreeRoot', 'IncorrectLeafCount'], */ 'ValidBlock'];

const incorrectTreeRoot = block => {
  logger.debug('Creating Incorrect Tree Root');
  const { root, ...rest } = block;
  return {
    root: `0x${BigInt(Math.floor(Math.random() * 2 ** 64))
      .toString(16)
      .padStart(64, '0')}`,
    ...rest,
  };
};

const incorrectLeafCount = block => {
  logger.debug('Creating Incorrect Leaf Count');
  const { leafCount, ...rest } = block;
  return {
    leafCount: Math.floor(Math.random() * 2 ** 16),
    ...rest,
  };
};

// eslint-disable-next-line import/prefer-default-export
export const createBadBlock = block => {
  const r = Math.floor(Math.random() * (error.length - 1));
  switch (error[r]) {
    case 'IncorrectTreeRoot':
      return incorrectTreeRoot(block);
    case 'IncorrectLeafCount':
      return incorrectLeafCount(block);
    default:
      return block;
  }
};
