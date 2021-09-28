/**
Module for processing layer 1 chain reoganisations.
It's probable that the Ethereum chain will undergo a reorganisation from time to
time.  This is an issue if our code does not alter its offchain record to take
account of such reorgs because then its state will be inconsistent with the
blockchain.

To address this, we note that each offchain state update is always triggered by
a blockchain event, which we're subscribed to. Thus we have to reorganise our
offchain state whenever one of these events is removed by a layer 1 reorg.

If we've been told that an event that occurred in the L1 block with number
blockNumberL1, has been removed, this means that all our off-chain L2 state
records are invalid beyond this point (inclusive of the point).  However, we don't
delete them because the L1 transactions that emitted them are back in the L1 mempool
and will be re-mined, and the events thus re-emitted. This requires handling in
slightly different ways, depending on the event.

TransactionSubmitted events:
When they are removed we set to null the L1 blockNumber that's stored with the
transaction.  This indicates to NF_3 that a chain reorg has happened so when the
event is re-mined NF_3 will not treat the re-mined event as a replay attack. We
keep mempool = true so that the re-mined events are not used by NF_3 to make
a new block.  If we don't do this we would get a re-mined block containing the
transactions and a new one made by NF_3, which would trigger a Duplicate
Transaction challenge.

BlockProposed events:

We don't really have to do much here, other than reset the L1 block number stored
in the L2 block data to null, to indicate to NF_3 that the re-mined BlockProposed
event is not a replay attack. Once the event is re-mined, all will be well.

NewCurrentProposer events:

We need to revert to the previous proposer on removal.  On re-mining, we'll go
back again. This ensures that the wrong person isn't proposing blocks, which will
then be reverted.
Note that these events (and their rmeoval) are not handled by the eventQueue.
Instead the event is handled immediately by its relevant handler.  This is
because the initial synchronisation code starts these events before the others.
This may cause a race in some circumstances.
TODO - modify intial sychronisation code and queue these events too.

CommittedToChallenge events:

These trigger a commitment reveal transaction.  As the reveal transaction will
exist and will be put back into the mempool as a result of the chain reorg, then
re-mined, we need to make sure that the re-mining of this event does not trigger
yet another reveal transaction. That will cause the sender to waste a significant
amount of gas because challenges are generally expensive. We do that by making
the call to the revealChallenge function only happen once.

Rollback events:

TODO - rollback code is currently undergoing changes.

*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import rollbackEventHandler from './rollback.mjs';
import sync from '../services/state-sync.mjs';
import {
  clearBlockNumberL1ForBlock,
  clearBlockNumberL1ForTransaction,
  isRegisteredProposerAddressMine,
} from '../services/database.mjs';
import { waitForContract } from './subscribe.mjs';
import { pauseEventQueues, resumeEventQueues } from '../services/event-queue.mjs';

const { STATE_CONTRACT_NAME } = config;

export async function removeBlockProposedEventHandler(eventObject) {
  return clearBlockNumberL1ForBlock(eventObject.transactionHash);
}

export async function removeTransactionSubmittedEventHandler(eventObject) {
  return clearBlockNumberL1ForTransaction(eventObject.transactionHash);
}

export async function removeNewCurrentProposerEventHandler(data, args) {
  const { proposer: currentProposer } = data.returnValues;
  const [proposer] = args;
  try {
    logger.info(`Proposer Removal Handler - Current proposer is ${currentProposer}`);
    // the chain re-org will have reverted the proposer so we need to update our
    // local records to match what the chain now thinks is the current proposer.
    // It's entirely possible that the NewCurrentProposer proposer event will
    // re-appear when the transaction gets re-mined but that's ok, it will look
    // like an early rotation of the proposers.
    const stateContractInstance = waitForContract(STATE_CONTRACT_NAME);
    proposer.address = (await stateContractInstance.methods.currentProposer.call()).thisAddress;
    proposer.isMe = !!(await isRegisteredProposerAddressMine(proposer.address));
  } catch (err) {
    // handle errors
    logger.error(err);
    throw new Error(err); // pass error handling up the call stack
  }
}

// there is no need to handle removal of a CommittedToChallenge event because
// the handler will only reveal a challenge once. This means that when the event
// is re-mined, it won't cause a second call to revealChallenge.
export async function removeCommittedToChallengeEventHandler() {
  logger.debug('Handled removal of CommittedToChallengeEvent');
}

/*
When a rollback happens, there are two different cases.  If the rollback did not
alter L2 state that was added in L1 blocks before the point of the fork, then there
is nothing to do. The new state will be written when events come in from the new
branch of the fork.  However, it's possible that the rollback extended beyond the
point of the fork.  In this case, we'll have deleted state that we now want and,
even worse, we might have over-written it with new state which is now invalidated
by the removal of the rollback.
*/
export async function removeRollbackEventHandler(eventObject, args) {
  logger.debug('Remove rollback event handler');
  const [proposer] = args;
  // Now, all L2 blocks with a blockNumberL2 >= to the rollback point are invalid
  // because they were added after the rollback and wouldn't have been added if
  // the rollback never happened. So, let's clean them out by re-rolling back to
  // the start of the original rollback - but stop new events being processed first!
  await pauseEventQueues();
  await rollbackEventHandler(eventObject);
  // now we're back to something clean, we can rebuild the L2 state, travelling
  // along the new L1 branch when we reach it.
  sync(proposer);
  // we're done.  Start the event queue again.
  resumeEventQueues();
}
