/* eslint-disable no-await-in-loop */

import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { pauseQueue, unpauseQueue, queues, flushQueue } from 'common-files/utils/event-queue.mjs';
import logger from 'common-files/utils/logger.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import newCurrentProposerEventHandler from '../event-handlers/new-current-proposer.mjs';
import committedToChallengeEventHandler from '../event-handlers/challenge-commit.mjs';
import rollbackEventHandler from '../event-handlers/rollback.mjs';
import { getBlockByBlockNumberL2, getBlocks, getLatestBlockInfo } from './database.mjs';
import { stopMakingChallenges, startMakingChallenges } from './challenges.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

// TODO can we remove these await-in-loops?

const { SHIELD_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME, STATE_CONTRACT_NAME } = constants;

const syncState = async (
  proposer,
  fromBlock = 'earliest',
  toBlock = 'latest',
  eventFilter = 'allEvents',
) => {
  const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME); // NewCurrentProposer (register)
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME); // TransactionSubmitted
  const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME); // Rollback, NewCurrentProposer, BlockProposed

  const pastProposerEvents = await proposersContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });
  const pastShieldEvents = await shieldContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });
  const pastStateEvents = await stateContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });

  // Put all events together and sort chronologically as they appear on Ethereum
  const splicedList = pastProposerEvents
    .concat(pastShieldEvents)
    .concat(pastStateEvents)
    .sort((a, b) => a.blockNumber - b.blockNumber);
  for (let i = 0; i < splicedList.length; i++) {
    const pastEvent = splicedList[i];
    switch (pastEvent.event) {
      case 'NewCurrentProposer':
        await newCurrentProposerEventHandler(pastEvent, [proposer]);
        break;
      case 'Rollback':
        await rollbackEventHandler(pastEvent);
        break;
      case 'TransactionSubmitted':
        await transactionSubmittedEventHandler(pastEvent);
        break;
      case 'BlockProposed':
        await blockProposedEventHandler(pastEvent);
        break;
      case 'CommittedToChallenge':
        await committedToChallengeEventHandler(pastEvent);
        break;
      default:
        break;
    }
  }
};

const checkBlocks = async () => {
  const blocks = await getBlocks();
  const gapArray = [];
  if (blocks.length > 0) {
    // Existing blocks found stored locally
    let expectedLeafCount = 0;
    // Loop through all our blocks to find any gaps in our internal block data
    for (let i = 0; i < blocks.length - 1; i++) {
      // If the leafCount of the next block stored internally does not match what we expect the leaf count to be
      // it means we may have a gap in our blockData
      expectedLeafCount += blocks[i + 1].nCommitments;
      if (blocks[i].leafCount !== expectedLeafCount) {
        // if we are in the first iteration it means we have a problem with our internal data
        // let's just restart the sync from earliest,
        // else let's just scan from the Ethereum blockNumber that is one more than our known correct block.
        const fromBlock = i === 0 ? 'earliest' : blocks[i - 1].blockNumber + 1;
        // we will scan the gap up to the blockNumber of the current blocks
        const toBlock = blocks[i].blockNumber - 1;
        gapArray.push([fromBlock, toBlock]);
        // reset so we can find more
        expectedLeafCount = blocks[i].leafCount;
      }
    }
    if (gapArray.length > 0) return gapArray; // We found some missing blocks
    const fromBlock = blocks[blocks.length - 1].blockNumber + 1;
    return [[fromBlock, 'latest']];
  }
  return [['earliest', 'latest']];
};

export default async proposer => {
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  const lastBlockNumberL2 = Number(
    (await stateContractInstance.methods.getNumberOfL2Blocks().call()) - 1,
  );
  if (lastBlockNumberL2 === -1) {
    unpauseQueue(0); // queues are started paused, therefore we need to unpause them before proceeding.
    unpauseQueue(1);
    startMakingChallenges();
    return null; // The blockchain is empty
  }
  // pause the queues so we stop processing incoming events while we sync
  await Promise.all([pauseQueue(0), pauseQueue(1)]);

  logger.info('Begining synchronisation with the blockchain');

  const missingBlocks = await checkBlocks(); // Stores any gaps of missing blocks
  const latestBlockLocally = (await getBlockByBlockNumberL2(lastBlockNumberL2)) ?? undefined;

  if (!latestBlockLocally || missingBlocks[0] !== latestBlockLocally.blockNumber + 1) {
    // The latest block stored locally does not match the last on-chain block
    // or we have detected a gap in the L2 blockchain
    await stopMakingChallenges();
    for (let i = 0; i < missingBlocks.length; i++) {
      const [fromBlock, toBlock] = missingBlocks[i];
      // Sync the state inbetween these blocks
      await syncState(proposer, fromBlock, toBlock);
    }

    /*
     at this point, we have synchronised all the existing blocks. If there are no outstanding
     challenges (all rollbacks have completed) then we're done.  It's possible however that
     we had a bad block that was not rolled back. If this is the case then there will still be
     a challenge in the stop queue that was not removed by a rollback.
     If this is the case we'll run the stop queue to challenge the bad block.
    */
    await startMakingChallenges();
    if (queues[2].length === 0)
      logger.info('After synchronisation, no challenges remain unresolved');
    else {
      logger.info(
        `After synchronisation, there were ${queues[2].length} unresolved challenges.  Running them now.`,
      );

      // start queue[2] and await all the unresolved challenges being run
      const p = flushQueue(2);
      queues[2].start();
      await p;
      logger.debug('All challenges in the stop queue have now been made.');
    }
  }
  const currentProposer = (await stateContractInstance.methods.currentProposer().call())
    .thisAddress;
  if (currentProposer !== proposer.address) {
    await newCurrentProposerEventHandler({ returnValues: { proposer: currentProposer } }, [
      proposer,
    ]);
  }

  unpauseQueue(0);
  unpauseQueue(1);

  return (await getLatestBlockInfo()).blockNumber;
};
