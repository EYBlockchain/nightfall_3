/* ignore unused exports */
import logger from 'common-files/utils/logger.mjs';

const error = [
  'ValidBlock',
  'ValidBlock',
  'ValidBlock',
  'IncorrectTreeRoot', // Needs two prior blocks
  'ValidBlock',
  'IncorrectLeafCount', //  Needs one prior block
  'ValidBlock',
  'DuplicateTransaction', // needs atleast one transaction in a prior block
  'ValidBlock',
  'DuplicateNullifier', // needs atleast one non deposit transaction in a prior block
  'ValidBlock',
  'HistoricRootError',
  'ValidBlock',
  'IncorrectProof',
  'ValidBlock',
];

// eslint-disable-next-line no-unused-vars
const incorrectTransactionHashesRoot = block => {
  // TODO implement this
};

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
export const createBadBlock = (block, errorIndex) => {
  logger.debug('Creating a block of type', error[errorIndex]);
  switch (error[errorIndex]) {
    case 'IncorrectTreeRoot':
      return incorrectTreeRoot(block);
    case 'IncorrectLeafCount':
      return incorrectLeafCount(block);
    default:
      return block;
  }
};
