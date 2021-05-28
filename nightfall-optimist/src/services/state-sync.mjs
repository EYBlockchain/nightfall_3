import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import newCurrentProposerEventHandler from '../event-handlers/new-current-proposer.mjs';
import committedToChallengeEventHandler from '../event-handlers/challenge-commit.mjs';
import blockDeletedEventHandler from '../event-handlers/block-deleted.mjs';
import { callTimberHandler } from '../utils/timber.mjs';
import { getBlockByBlockNumberL2 } from './database.mjs';
import { stopMakingBlocks, startMakingBlocks } from './block-assembler.mjs';
import { stopMakingChallenges, startMakingChallenges } from './challenges.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

const { CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME } = config;

export const syncState = async proposer => {
  const proposalsContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const pastProposalEvents = await proposalsContractInstance.getPastEvents({
    fromBlock: 'earliest',
  });
  const pastShieldEvents = await shieldContractInstance.getPastEvents({ fromBlock: 'earliest' });
  const splicedList = pastProposalEvents
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

const BLOCKS_BEHIND = 1;

export const initialBlockSync = async proposer => {
  logger.info(`initialBlockSync Proposer: ${proposer.address}`);
  await waitForContract(CHALLENGES_CONTRACT_NAME);
  const proposalsContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
  const blockNumberL2 = Number(await proposalsContractInstance.methods.getBlockNumberL2().call()); // get the length of the on-chain blockHash array
  if (blockNumberL2 === 0) return; // The blockchain is empty
  // Check if we have the most recent block that we want to be synced to
  const latestBlockLocally =
    (await getBlockByBlockNumberL2(blockNumberL2 - BLOCKS_BEHIND)) ?? undefined;
  // If not, we're too far behind so let's sync
  if (!latestBlockLocally) {
    await stopMakingBlocks();
    await stopMakingChallenges();
    await syncState(proposer);
    await startMakingBlocks();
    await startMakingChallenges();
    return;
  }
  // Could use currentProposer
  const currentProposer = (await proposersContractInstance.methods.currentProposer().call())
    .thisAddress;
  await newCurrentProposerEventHandler({ returnValues: { proposer: currentProposer } }, [proposer]);
  // logger.info(`Propopser is :${JSON.stringify(proposer)}`);
  // const pastProposerEvents = await proposersContractInstance.getPastEvents({ fromBlock: 'earliest' });
  // const newProposerEvents = pastProposerEvents
  //   .filter(p => p.event === 'NewCurrentProposer')
  //   .sort((a, b) => a.blockNumber - b.blockNumber);
  // await newCurrentProposerEventHandler(newProposerEvents[newProposerEvents.length - 1], [proposer]);
};
