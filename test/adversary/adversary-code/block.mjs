/* ignore unused exports */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

let error = process.env.BAD_BLOCK_SEQUENCE
  ? process.env.BAD_BLOCK_SEQUENCE.split(',')
  : [
      'ValidBlock',
      'ValidBlock',
      'ValidBlock',
      // 'IncorrectTreeRoot', // Needs two prior blocks
      // 'IncorrectLeafCount', //  Needs one prior block
      'DuplicateCommitmentTransfer', // needs atleast one non withdraw transaction in a prior block
      'DuplicateCommitmentDeposit',
      'DuplicateNullifierTransfer', // needs atleast one non deposit transaction in a prior block
      'IncorrectProofDeposit',
      'IncorrectProofTransfer',
      'IncorrectPublicInputDepositCommitment',
      'IncorrectPublicInputTransferCommitment',
      'IncorrectPublicInputTransferNullifier',
      'ValidBlock',
      'DuplicateNullifierWithdraw', // needs atleast one non deposit transaction in a prior block
      'IncorrectProofWithdraw',
      'IncorrectPublicInputWithdrawNullifier',
      'IncorrectHistoricRoot', // TODO IncorrectHistoricRootTransfer and IncorrectHistoricRootWithdraw
      'ValidBlock',
    ];

// let error = process.env.BAD_BLOCK_SEQUENCE
//   ? process.env.BAD_BLOCK_SEQUENCE.split(',')
//   : [
//       'ValidBlock',
//       'ValidBlock',
//       'ValidBlock',
//       // 'IncorrectTreeRoot', // Needs two prior blocks
//       // 'ValidBlock',
//       'IncorrectLeafCount', //  Needs one prior block
//       'ValidBlock',
//       'DuplicateCommitmentTransfer', // needs atleast one non withdraw transaction in a prior block
//       'DuplicateCommitmentDeposit',
//       // 'ValidBlock',
//       // 'DuplicateCommitmentDeposit', // needs atleast one non withdraw transaction in a prior block
//       'ValidBlock',
//       'DuplicateNullifierTransfer', // needs atleast one non deposit transaction in a prior block
//       'ValidBlock',
//       'DuplicateNullifierWithdraw', // needs atleast one non deposit transaction in a prior block
//       'ValidBlock',
//       // 'IncorrectProofDeposit',
//       // 'ValidBlock',
//       // 'IncorrectProofTransfer',
//       // 'ValidBlock',
//       // 'IncorrectProofWithdraw',
//       // 'ValidBlock',
//       // 'IncorrectPublicInputDepositCommitment',
//       // 'ValidBlock'
//       // 'IncorrectPublicInputTransferCommitment',
//       // 'ValidBlock'
//       // 'IncorrectPublicInputTransferNullifier',
//       // 'ValidBlock'
//       // 'IncorrectPublicInputWithdrawNullifier',
//       // 'ValidBlock'
//     ];

let resetErrorIdx = false;
let indexOffset = 0;

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

export const addBlock = blockType => {
  error = blockType;
  resetErrorIdx = true;
  logger.debug(`Received new block types to generate ${error}`);
};

// eslint-disable-next-line import/prefer-default-export
export const createBadBlock = (block, errorIndex) => {
  if (resetErrorIdx) {
    resetErrorIdx = false;
    indexOffset = errorIndex;
  }
  const badBlockType = error[errorIndex - indexOffset];
  logger.debug(`Creating a block of type ${badBlockType}`);
  switch (badBlockType) {
    case 'IncorrectTreeRoot':
      return incorrectTreeRoot(block);
    case 'IncorrectLeafCount':
      return incorrectLeafCount(block);
    default:
      return block;
  }
};
