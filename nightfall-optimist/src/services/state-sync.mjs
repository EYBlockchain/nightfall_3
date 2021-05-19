import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import newCurrentProposerEventHandler from '../event-handlers/new-current-proposer.mjs';
import committedToChallengeEventHandler from '../event-handlers/challenge-commit.mjs';
import blockDeletedEventHandler from '../event-handlers/block-deleted.mjs';
import { callTimberHandler } from '../utils/timber.mjs';
import { getBlockByBlockHash, getBlocks } from './database.mjs';
import { stopMakingBlocks, startMakingBlocks } from './block-assembler.mjs';
import { stopMakingChallenges, startMakingChallenges } from './challenges.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

const { CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME, ZERO } = config;

export const syncState = async (proposer, fromBlock='earliest', toBlock='latest', eventFilter = 'allEvents') => {
  logger.info(`fromBlock: ${fromBlock}`)
  logger.info(`toBlock: ${toBlock}`)
  const proposersContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const pastProposerEvents = await proposersContractInstance.getPastEvents(eventFilter, {
    fromBlock: fromBlock,
    toBlock: toBlock
  });
  const pastShieldEvents = await shieldContractInstance.getPastEvents(eventFilter,{ fromBlock: fromBlock, toBlock: toBlock });
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

export const initialBlockSync = async proposer => {
  await waitForContract(CHALLENGES_CONTRACT_NAME);
  const proposersContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  let endHash = await proposersContractInstance.methods.endHash().call();
  if (endHash === ZERO) return; // The blockchain is empty
  
  const missingBlocks = await checkBlocks(); // Stores any gaps of missing blocks
  const [fromBlock, ] = missingBlocks[0]
  const latestBlockLocally = (await getBlockByBlockHash(endHash)) ?? undefined;
  if (!latestBlockLocally || fromBlock !== (latestBlockLocally.blockNumber + 1)) {
    // The latest block stored locally does not match the endHash on-chain
    // or we have detected a gap in the L2 blockchain
    await stopMakingChallenges();
    for(let i = 0; i< missingBlocks.length; i++) {
      const [fromBlock,toBlock] = missingBlocks[i]
      logger.info(`Missing Blocks, resyncing between ${fromBlock} and ${toBlock} `);
      // Sync the state inbetween these blocks
      await syncState(proposer,fromBlock,toBlock);
    };
    await startMakingChallenges();
  }
  const currentProposer = (await proposersContractInstance.methods.currentProposer().call())
    .thisAddress;
    await newCurrentProposerEventHandler({ returnValues: { proposer: currentProposer } }, [proposer]);
  
  return;
};

export const checkBlocks = async () => {
  const blocks = await getBlocks();
  const gapArray = [];
  if(blocks.length > 0) {
    // Existing blocks found stored locally
    let expectedLeafCount = 0;
    for(let i = 0; i < blocks.length; i++){
      if (blocks[i].leafCount !== expectedLeafCount) {
        const fromBlock = i === 0 ? 'earliest' : blocks[i-1].blockNumber + 1;
        const toBlock = blocks[i].blockNumber - 1; 
        gapArray.push([fromBlock,toBlock]);
      } else {
        expectedLeafCount = blocks[i].leafCount //reset so we can find more
      }
      expectedLeafCount += blocks[i].nCommitments
    }
    if (gapArray.length > 0) return gapArray //We found some missing blocks
    const fromBlock = blocks[blocks.length - 1].blockNumber + 1
    return [[fromBlock, 'latest']];
  }
  return [['earliest', 'latest']]
}