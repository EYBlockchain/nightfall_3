/* eslint-disable no-await-in-loop */

import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import newCurrentProposerEventHandler from '../event-handlers/new-current-proposer.mjs';
import committedToChallengeEventHandler from '../event-handlers/challenge-commit.mjs';
import rollbackEventHandler from '../event-handlers/rollback.mjs';
import { getBlockByBlockNumberL2, getBlocks } from './database.mjs';
import { stopMakingChallenges, startMakingChallenges } from './challenges.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

// TODO can we remove these await-in-loops?

const { SHIELD_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME, STATE_CONTRACT_NAME } = config;

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
        // eslint-disable-next-line no-await-in-loop
        await newCurrentProposerEventHandler(pastEvent, [proposer]);
        break;
      case 'Rollback':
        await rollbackEventHandler(pastEvent);
        break;
      case 'BlockProposed':
        // eslint-disable-next-line no-await-in-loop
        await blockProposedEventHandler(pastEvent);
        break;
      case 'CommittedToChallenge':
        // eslint-disable-next-line no-await-in-loop
        await committedToChallengeEventHandler(pastEvent);
        break;
      case 'TransactionSubmitted':
        // eslint-disable-next-line no-await-in-loop
        await transactionSubmittedEventHandler(pastEvent);
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
    for (let i = 0; i < blocks.length; i++) {
      // If the leafCount of the next block stored internally does not match what we expect the leaf count to be
      // it means we may have a gap in our blockData
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
      expectedLeafCount += blocks[i].nCommitments;
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
  if (lastBlockNumberL2 === 0) return; // The blockchain is empty

  const missingBlocks = await checkBlocks(); // Stores any gaps of missing blocks
  // const [fromBlock] = missingBlocks[0];
  const latestBlockLocally = (await getBlockByBlockNumberL2(lastBlockNumberL2)) ?? undefined;
  if (!latestBlockLocally || missingBlocks[0] !== latestBlockLocally.blockNumber + 1) {
    // The latest block stored locally does not match the last on-chain block
    // or we have detected a gap in the L2 blockchain
    await stopMakingChallenges();
    for (let i = 0; i < missingBlocks.length; i++) {
      const [fromBlock, toBlock] = missingBlocks[i];
      // Sync the state inbetween these blocks
      // eslint-disable-next-line no-await-in-loop
      await syncState(proposer, fromBlock, toBlock);
    }
    await startMakingChallenges();
  }
  const currentProposer = (await stateContractInstance.methods.currentProposer().call())
    .thisAddress;
  await newCurrentProposerEventHandler({ returnValues: { proposer: currentProposer } }, [proposer]);
};
