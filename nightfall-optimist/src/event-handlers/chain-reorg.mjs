/**
Module for processing layer 1 chain reoganisations.
It's probable that the Ethereum chain will undergo a reorganisation from time to
time.  This is an issue if our code does not alter its offchain record to take
account of such reorgs because then its state will be inconsistent with the
blockchain.
To address this, we note that each offchain state update is always triggered by
a blockchain event, which we're subscribed to. Thus we have to reorganise our
offchain state whenever one of these events is removed by a layer 1 reorg.
This effectively mean rewriting all state beyond the point (layer 1 blocknumber)
at which an event is removed by replaying all the events from that point until
we reach the new present.
Of course, we could get other events removed while we're doing that. In fact its
likely that we will if the reorg is a few blocks deep.  That would be a nightmare
of racing asyncs as each event caused a layer 2 reorg on top of another ongoing
reorg.
We can do better by checking, as we re-apply state event-by-event, whether an
event we're about to rewrite is in our list of removed events (same tx hash) if
it is then it's been removed as part of the same re-org and we don't need to
replay state again because of it - it will already be covered by our current re-
write.  If however its hash does not exist in the state we're re-writing then
it represents a re-org on our reorg and we must replay it separately.
*/

import { Mutex } from 'async-mutex';
import Web3 from '../utils/web3.mjs';
import {
  blockProposedEventHandler,
  rollbackEventHandler,
  newCurrentProposerEventHandler,
  committedToChallengeEventHandler,
} from './index.mjs';

const mutex = new Mutex();
const removedEventObjects = [];
async function replayEvents(eventObject) {
  const web3 = Web3.connection();
  // get the list of new events that exist after the reorg and order them by
  // ascending blockNumber then transaction index
  const eventsToReplay = await web3
    .getPastEvents('allEvents', {
      fromBlock: eventObject.blockNumber,
      toBlock: 'latest',
    })
    .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
  // then re-run the events one after the other (using a mutex to do that)
  for (let i = 0; i < eventsToReplay.length; i++) {
    mutex.runExclusive(async () => {
      let handler;
      switch (eventsToReplay[i].event) {
        case 'BlockProposed':
          handler = blockProposedEventHandler;
          break;
        case 'RollBack':
          handler = rollbackEventHandler;
          break;
        case 'NewProposer':
          handler = newCurrentProposerEventHandler;
          break;
        case 'CommittedToChallenge':
          handler = committedToChallengeEventHandler;
          break;
        default:
          handler = Promise.resolve();
          break;
      }
      return handler(eventsToReplay[i]);
    });
  }
}

async function chainReorgEventHandler(eventObject) {
  // we'll add this (removed) event object to an array and then replay all
  // subsequent events. We use a mutex to control concurrency to be 1.
  mutex.runExclusive(async () => {
    removedEventObjects.push(eventObject);
    return replayEvents(removedEventObjects.shift());
  });
}

export default chainReorgEventHandler;
