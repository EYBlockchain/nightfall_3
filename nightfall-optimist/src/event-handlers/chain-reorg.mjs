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
making them run sequentially (concurrency = 1). This is done via event-buffer.mjs.

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
import config from 'config';
import {
  deleteBlocksFromBlockNumberL1,
  deleteTransactionsFromBlockNumberL1,
  deleteNullifiersFromBlockNumberL1,
  getBlockByBlockNumberL2,
} from '../services/database.mjs';
import logger from '../utils/logger.mjs';
import { waitForContract } from './subscribe.mjs';

const {
  STATE_CONTRACT_NAME,
  PROPOSERS_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
} = config;

/**
If we've been told that an event that occurred in the L1 block with number
blockNumberL1, has been removed, this means that all our off-chain L2 state
records are invalid beyond this point (inclusive of the point).  So we delete
them.
*/
async function deleteState(blockNumberL1) {
  logger.info('Responding to layer 1 chain reorganisation - deleting state');
  return Promise.all([
    deleteBlocksFromBlockNumberL1(blockNumberL1),
    deleteTransactionsFromBlockNumberL1(blockNumberL1),
    deleteNullifiersFromBlockNumberL1(blockNumberL1),
  ]);
}

/**
If we've previously removed L2 state and we now wish that we hadn't, we can
replay the state back with this function. Note the replay is inclusive of
fromblockNumberL1 and toBlockNumberL1.
*/
async function resync(fromblockNumberL1, toBlockNumberL1, eventHandlers, eventQueue) {
  // get all the events and sort them into causal order by block and transaction
  const events = await Promise.all([
    (
      await waitForContract(STATE_CONTRACT_NAME)
    ).methods.events.allEvents({
      fromBlock: fromblockNumberL1,
      toBlock: toBlockNumberL1,
    }),
    (
      await waitForContract(SHIELD_CONTRACT_NAME)
    ).methods.events.allEvents({
      fromBlock: fromblockNumberL1,
      toBlock: toBlockNumberL1,
    }),
    (
      await waitForContract(PROPOSERS_CONTRACT_NAME)
    ).methods.events.allEvents({
      fromBlock: fromblockNumberL1,
      toBlock: toBlockNumberL1,
    }),
    (
      await waitForContract(CHALLENGES_CONTRACT_NAME)
    ).methods.events.allEvents({
      fromBlock: fromblockNumberL1,
      toBlock: toBlockNumberL1,
    }),
  ])
    .flat()
    .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
  // now replay them in order
  for (let i = 0; i < events.length; i++) {
    eventQueue.push(async () => eventHandlers[events[i].event](events[i]));
  }
}

export async function removeBlockProposedEventHandler(eventObject) {
  await deleteState(eventObject.blockNumber);
  return resync(eventObject.blockNumber, 'latest');
}

export async function removeRollbackEventHandler(eventObject) {
  const { blockNumberL2 } = eventObject.returnValues;
  // rollback needs to resync not from the point that the event occurred but
  // from the point that the rollback reached
  const { blockNumber: blockNumberL1 } = await getBlockByBlockNumberL2(blockNumberL2);
  await deleteState(blockNumberL1); // TODO can we just call rollback????
  return resync(blockNumberL1, 'latest');
}

export async function removeNewCurrentProposerEventHandler(eventObject) {
  await deleteState(eventObject.blockNumber);
  return resync(eventObject.blockNumber, 'latest');
}

export async function removeCommittedToChallengeEventHandler(eventObject) {
  await deleteState(eventObject.blockNumber);
  return resync(eventObject.blockNumber, 'latest');
}
