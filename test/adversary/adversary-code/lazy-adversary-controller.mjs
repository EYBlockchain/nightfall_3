/* eslint-disable no-undef */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { setBlockPeriodMs, setMakeNow } from './block-assembler.mjs';

const {
  PROPOSER_MAX_BLOCK_PERIOD_MILIS,
  OPTIMIST_ADVERSARY_BAD_BLOCK_GENERATION_PERIOD,
  OPTIMIST_ADVERSARY_BAD_BLOCK_SEQUENCE,
  OPTIMIST_ADVERSARY_CONTROLLER_ENABLED = false,
} = process.env;

let _blockGenerated = 0;
let _badBlockIndex = 0;

async function generateBlocks() {
  _blockGenerated++;
  let badBlockType = '';
  if (_blockGenerated % Number(OPTIMIST_ADVERSARY_BAD_BLOCK_GENERATION_PERIOD)) {
    const badBlockSequence = OPTIMIST_ADVERSARY_BAD_BLOCK_SEQUENCE.split(',');
    badBlockType = badBlockSequence[_badBlockIndex++];
    _badBlockIndex = _badBlockIndex % badBlockSequence.length;
  }

  logger.debug({
    msg: 'Generating New Block',
    badBlockType,
  });

  setMakeNow(true, badBlockType);
}

async function lazyAdversaryController() {
  if (OPTIMIST_ADVERSARY_CONTROLLER_ENABLED) {
    // configure make block time to 0 (never)
    setBlockPeriodMs(0);

    // generate blocks
    try {
      setInterval(() => generateBlocks(), PROPOSER_MAX_BLOCK_PERIOD_MILIS);
    } catch (err) {
      console.log(err.stack);
    }
  }
}

export default lazyAdversaryController;
