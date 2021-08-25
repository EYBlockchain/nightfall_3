/**
Module for processing layer 1 chain reoganisations.
It's probable that the Ethereum chain will undergo a reorganisation from time to
time.  This is an issue if our code does not alter its offchain record to take
account of such reorgs because then its state will be inconsistent with the
blockchain.

To address this, we note that each offchain state update is always triggered by
a blockchain event, which we're subscribed to. Thus we have to reorganise our
offchain state whenever one of these events is removed by a layer 1 reorg.
This is actually fairly straightforward for 'additive' events like a BlockProposed.
In that case, removal of a BlockProposed event means that any later 2 state after,
and including, that event is invalid because all subsequent state will depend on
that removed block. Thus we delete it. The new state will be written as new
events come in from the new layer 1 fork that we are now following (TBC).
We have to be careful that new events don't come in while we're deleting state
or we'll delete the new events too!  We do this by queueing incomming events and
making them run sequentially (concurrency = 1). This is done via event-queue.mjs.

Removal of a Rollback event is less straightforward.  The state after, and
including, the rollback will still be invalid because its built off of the block
we rolled back to. Thus, this part of the re-organisation is the same as for
a BlockProposer. However we will also have deleted layer 2 state in the original
rollback, which we now have to restore. Thus we need to work out the layer 1
block which contains the last layer 2 block that our rollback removed and replay
all the events from that layer 1 block (inclusive) but excluding the rollback.

Some events (CommittedToChallenge and NewCurrentProposer) don't cause layer 2
state updates directly.  They're triggers for the offchain system to do something,
for example to send a challenge in. That something will probably result in a
state change but we don't have to do any layer 2 state modification when one of
these events is removed because any state change that resulted will have been
initiated by another event, e.g. a Rollback. This is only true of course if the
responses to such events are idempotent. TODO consider further.
*/
// import config from 'config';
// import logger from 'common-files/utils/logger.mjs';
import {
  // getBlockByBlockNumberL2,
  clearBlockNumberL1ForBlock,
  clearBlockNumberL1ForTransaction,
} from '../services/database.mjs';
// import { waitForContract } from './subscribe.mjs';
/*
const {
  STATE_CONTRACT_NAME,
  PROPOSERS_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
} = config;
*/
/**
If we've been told that an event that occurred in the L1 block with number
blockNumberL1, has been removed, this means that all our off-chain L2 state
records are invalid beyond this point (inclusive of the point).  So we delete
them.

async function deleteBlockState(blockNumberL1) {
  logger.info(
    `Responding to layer 1 chain reorganisation - deleting state from block ${blockNumberL1}`,
  );
  return Promise.all([
    deleteBlocksFromBlockNumberL1(blockNumberL1),
    // deleteTransactionsFromBlockNumberL1(blockNumberL1),
    deleteNullifiersFromBlockNumberL1(blockNumberL1), // TODO is blockNumberL1 correct here?
  ]);
}
// Transactions don't hold the same L1 block number as Blocks, so they need to be
// deleted separately, according to the block number in which they were created
async function deleteTransactionState(blockNumberL1) {
  logger.info(
    `Responding to layer 1 chain reorganisation - deleting state from block ${blockNumberL1}`,
  );
  return deleteTransactionsFromBlockNumberL1(blockNumberL1);
}

/*
/**
If we've previously removed L2 state and we now wish that we hadn't, we can
replay the state back with this function. Note the replay is inclusive of
fromblockNumberL1 and toBlockNumberL1.
*/
/*
async function resync(fromblockNumberL1, toBlockNumberL1, eventHandlers, eventQueue) {
  // get all the events and sort them into causal order by block and transaction
  const events = (
    await Promise.all([
      (
        await waitForContract(STATE_CONTRACT_NAME)
      ).getPastEvents('allEvents', {
        fromBlock: fromblockNumberL1,
        toBlock: toBlockNumberL1,
      }),
      (
        await waitForContract(SHIELD_CONTRACT_NAME)
      ).getPastEvents('allEvents', {
        fromBlock: fromblockNumberL1,
        toBlock: toBlockNumberL1,
      }),
      (
        await waitForContract(PROPOSERS_CONTRACT_NAME)
      ).getPastEvents('allEvents', {
        fromBlock: fromblockNumberL1,
        toBlock: toBlockNumberL1,
      }),
      (
        await waitForContract(CHALLENGES_CONTRACT_NAME)
      ).getPastEvents('allEvents', {
        fromBlock: fromblockNumberL1,
        toBlock: toBlockNumberL1,
      }),
    ])
  )
    .flat()
    .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
  // now replay them in order
  for (let i = 0; i < events.length; i++) {
    eventQueue.push(async () => eventHandlers[events[i].event](events[i]));
  }
}
*/

/**
If we've been told that an event that occurred in the L1 block with number
blockNumberL1, has been removed, this means that all our off-chain L2 state
records are invalid beyond this point (inclusive of the point).  However, we don't
delete them because the L1 transactions that emitted them are back in the L1 mempool
and will be re-mined and the events thus re-emitted.  If we simply delete the L2
state then we will get two new L2 blocks: one from when the L1 submitTransaction
events are re-emitted, which will cause the block-assembler to make a new block,
and one from when the original proposeBlock transaction is re-mined and the
BlockProposed event re-emitted.  This will make NF_3 think that someone is trying
to post a duplicate transaction and a challenge will be made.
To prevent this, we'll just remove the information about which L1 block the event
is in (this info is held in the relevant L2 collection) to indicate that it's
back in the mempool. Then, when the same event is re-emitted, we'll detect that
and assign a new L1 block to the data. Thus, if we get a duplicate event but the
sotred event has no L1 blockNumber, that indicates this is a chain-reorg, not a
duplicate transaction.
*/
export async function removeBlockProposedEventHandler(eventObject) {
  return clearBlockNumberL1ForBlock(eventObject.transactionHash);
}

export async function removeTransactionSubmittedEventHandler(eventObject) {
  return clearBlockNumberL1ForTransaction(eventObject.transactionHash);
}

/*
// TODO this probably needs to resync some state but not all -
export async function removeRollbackEventHandler(eventObject, eventHandlers, eventQueue) {
  const { blockNumberL2 } = eventObject.returnValues;
  // rollback needs to resync not from the point that the event occurred but
  // from the point that the rollback reached
  const { blockNumber: blockNumberL1 } = await getBlockByBlockNumberL2(blockNumberL2);
  return deleteBlockState(blockNumberL1); // TODO can we just call rollback????
  // return resync(blockNumberL1, 'latest', eventHandlers, eventQueue);
}

export async function removeNewCurrentProposerEventHandler(eventObject) {
  return deleteBlockState(eventObject.blockNumber);
  // return resync(eventObject.blockNumber, 'latest', eventHandlers, eventQueue);
}

export async function removeCommittedToChallengeEventHandler(eventObject) {
  return deleteBlockState(eventObject.blockNumber);
  // return resync(eventObject.blockNumber, 'latest', eventHandlers, eventQueue);
}
*/
