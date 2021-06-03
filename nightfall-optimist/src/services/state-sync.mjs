import config from 'config';
import { getContractInstance } from '../utils/contract.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import newCurrentProposerEventHandler from '../event-handlers/new-current-proposer.mjs';
import committedToChallengeEventHandler from '../event-handlers/challenge-commit.mjs';
import blockDeletedEventHandler from '../event-handlers/block-deleted.mjs';
import { callTimberHandler } from '../utils/timber.mjs';
import { getBlockByBlockNumberL2, getBlocks } from './database.mjs';
import { stopMakingChallenges, startMakingChallenges } from './challenges.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

const { CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME } = config;

export const syncState = async (
  proposer,
  fromBlock = 'earliest',
  toBlock = 'latest',
  eventFilter = 'allEvents',
) => {
  const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const pastProposerEvents = await proposersContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });
  const pastShieldEvents = await shieldContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });
  const splicedList = pastProposerEvents
    .concat(pastShieldEvents)
    .sort((a, b) => a.blockNumber - b.blockNumber);
  for (let i = 0; i < splicedList.length; i++) {
    const pastEvent = splicedList[i];
    switch (pastEvent.event) {
      case 'NewCurrentProposer':
        await newCurrentProposerEventHandler(pastEvent, [proposer]);
        break;
      case 'NewLeaf':
      case 'Rollback':
      case 'NewLeaves':
        await callTimberHandler(pastEvent);
        break;
      case 'BlockProposed':
        await callTimberHandler(pastEvent);
        await blockProposedEventHandler(pastEvent);
        break;
      case 'CommittedToChallenge':
        await committedToChallengeEventHandler(pastEvent);
        break;
      case 'BlockDeleted':
        await blockDeletedEventHandler(pastEvent);
        break;
      case 'TransactionSubmitted':
        await transactionSubmittedEventHandler(pastEvent);
        break;
      default:
        break;
    }
  }
};

export const checkBlocks = async () => {
  const blocks = await getBlocks();
  const gapArray = [];
  if (blocks.length > 0) {
    // Existing blocks found stored locally
    let expectedLeafCount = 0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].leafCount !== expectedLeafCount) {
        const fromBlock = i === 0 ? 'earliest' : blocks[i - 1].blockNumber + 1;
        const toBlock = blocks[i].blockNumber - 1;
        gapArray.push([fromBlock, toBlock]);
      } else {
        expectedLeafCount = blocks[i].leafCount; // reset so we can find more
      }
      expectedLeafCount += blocks[i].nCommitments;
    }
    if (gapArray.length > 0) return gapArray; // We found some missing blocks
    const fromBlock = blocks[blocks.length - 1].blockNumber + 1;
    return [[fromBlock, 'latest']];
  }
  return [['earliest', 'latest']];
};

export const initialBlockSync = async proposer => {
  const proposalsContractInstance = await waitForContract(CHALLENGES_CONTRACT_NAME);
  const proposersContractInstance = await waitForContract(PROPOSERS_CONTRACT_NAME);
  const lastBlockNumberL2 = Number(
    await proposalsContractInstance.methods.getBlockNumberL2().call(),
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
      await syncState(proposer, fromBlock, toBlock);
    }
    await startMakingChallenges();
  }
  const currentProposer = (await proposersContractInstance.methods.currentProposer().call())
    .thisAddress;
  await newCurrentProposerEventHandler({ returnValues: { proposer: currentProposer } }, [proposer]);
};
