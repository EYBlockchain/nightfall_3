# How Nightfall_3 Copes with Chain Reorganisations

A chain reorganisation happens when the local node realises that it is not in consensus with the canonical chain
and it abandons the chain branch it was operating on for the heavier canonical chain.

When this happens, there are a number of Layer 1 changes. Nightfall_3 must update its Layer 2 record so that it
is consistent with the new layer two state.

For clarity we will call the branch that is to be abandoned in favour of the new consensus the `uncle` branch
and the new, heavier branch which is part of the canonical chain, the `canonical` branch.

## The effect of a reorg on Layer 1

The transactions in the uncle branch are returned to the mempool and, from the point of view of the local node
are replaced by those in the canonical branch. Eventually they will be re-mined and this may not be in the
same order that they were originally created (although nonces are respected).  Thus dependencies between
the transactions may cause some to revert even though they worked on the uncle branch.

## The effect of a reorg on Layer 2

The L2 state is held both in Optimist and Timber (soon these will be combined). The state is updated in response
to L1 emitting blockchain events, which the L2 code listens for, for example a BlockProposed event.  These are
all defined in Structures.sol.

When a L1 chain reorg happens, the following will be seen by the listeners:

1) The events in the uncle branch will be replayed except that they will trigger a 'changed' rather than a 'data'
event type, and the event object will have a `.removed` property, which is set to `true` (NF_3 uses the property
value rather than the event type).

2) The events in the canonical branch will be played to them in the order they appear on the canonical branch.

3) The L1 transactions that were in the uncle branch will re-play as they are re-mined from the Mempool. Most
of these transactions will emit L2 events which will not necessarily be in the original order, although nonce
order for each `fromAddress` will be respected.

## Handling a chain reorg (no rollback)

When there is a reorg which does not revert a L2 rollback, the situation is simplified. We will treat this case
first.

### Layer 1 (smart contract state)

From the point of view of the local node, we see L2 Block hashes sequentially added to the blockchain record.
Suppose that the local node has the following L2 blockHash record:
```
H_0, H_1 ... H_r, H_s ... H_n
```
Let's further suppose there is a heavier chain segment out there with alternative facts:
```
H_0, H_1 ... H_r, H'_s ... H'_m
```
Note that the chains differ (fork) just after H_r.  After that point, they no longer agree on the blockchain record.

Eventually, there will be a chain reorg and the heavier branch will become the canonical chain. At that point, the
local node will agree that the correct chain is:
```
H_0, H_1 ... H_r, H'_s ... H'_m
```
and there will be a set of L1 transactions in the Mempool, corresponding to those on the now defunct uncle branch:
```
H_s ... H_n
```
The next thing that will happen is that the miners will pick up the transactions in the mempool; we say that they
will be 're-mined'.  Note however that each Block struct (see Structures.sol) contains the hash of the previous block
and the ordinal number of the block. The `proposeBlock` function checks these for correctness before adding a block hash
to the `blockHashes` array. In this case, certainly the previous block hash check and probably the block number hash
will fail and the transaction will revert.  Effectively, these uncle transactions will be cleared from the Mempool
and no state changes will result. This is exactly what we want to achieve.

Any L2 transactions that were submitted to the uncle chain will also be re-mined.  Their L1 transactions will all
succeed and they will be re-notarised to the blockchain.  They may or may not be valid depending on whether they
have dependencies on earlier transactions that no longer exist, or now occur later because they were re-mined out
of order.

### Layer 2 (Optimist)

Firstly, Optimist sees the event removals.  When it receives a BlockProposed event removal, it finds the block in its
database and sets the block's L1 block number to null.  This indicates to NF_3 that the Block hash has been removed from the L1 chain.
You might imagine we could just delete these blocks, but we can't.  We'll explain why in a bit.

Next, Optimist sees the new events (if any) come in from the canonical chain. It will check these and they should pass its
checks because they will fit on the existing blocks at the L2 blockNumber they have.

Finally, BlockProposed events will come from the re-mining of the transactions that were on the uncle branch. There
will only be these if there were no BlockProposed events on the canonical branch - otherwise the transactions
will revert at layer 1 (see previous section) and never emit an event.  

If such events do exist (and this is quite likely if there aren't many NF_3 transactions on the chain), then they will
pass the NF_3 checks and the L2 blocks will be added to the database. However, their L2 transactions will also be re-mined.
These are potentially still perfectly valid and will pass NF_3's checks. This is, however, a problem. Being valid, these L2
transactions will trigger the block assembler. This creates another block containing the same transactions (one block coming
from the re-mine, one from the block assembler).  That will be seen as a L2 transaction replay attack by Optimist. To prevent
that we:
1) trap incoming transactions (function `checkAlreadyInBlock` has this job)
2) see if they already exist in a block. If yes, check that the blocks L1 block number is null, otherwise throw a duplicate
transaction challenge. This check is why we cannot delete the removed block (above) and instead set its L1 blocknumber to null.
If we did delete the block, and these transactions were re-mined before the block containing them was re-mined, we'd think
they were new transactions.
3) If they are already in a block and we've determined they aren't really duplicates, then we set their mempool
property to `false`. That will prevent the block assembler from picking them up and creating yet another block with them in.
Eventually their original block will be re-mined, if it hasn't been already.  The timelines will be restored and
all will be well once more.

### Layer 2 (Timber)

Like Optimist, Timber firstly sees the event removals. Remember that Timber does not really understand the concept of L2 blocks
and transactions.  Therefore it simply filters L2 BlockProposed event calldata to extract commitment data, on which it operates.
When Timber receives a removal for a `BlockProposed` event, it computes the `leafCount` (number of leaves in the Merkle Tree)
which existed before the commitments in the removed block were added.  It then calls its `rollback` function to reset the
Merkle tree back to the point just before the removed L2 block's commitments were added.  This is slightly inefficient in
that it may call rollback more times than absolutely necessary. For now though, it has the benefit of simplicity.

The next thing that happens is that events from the new canonical branch are emitted.  Timber will add any commitments
associated with the `BlockProposed` events into its tree.

Finally, any re-mined `BlockProposed` events will be added.  These will only appear if they pass the L1 checks and are
compatible with the new blocks added by the canonical chain.

### Layer 2 (Client)

Client tracks the commitments owned by its user(s).  It will record whether a commitment is spent or not.  Specifically,
it remembers:

1) If a Deposit transaction has been successfully computed (`.isDeposited`)
2) If the transaction has made it on chain as part of a Block (`.isOnChain`)
3) If it has been nullified locally (`.isNullified`)
4) If the nullification has made it on chain as part of a Block (`.isNullifiedOnChain`)
5) If the commitment has been selected for spending but not yet nullified (`isPendingNullification`)

If a chain reorganisation happens then it may well change the status of some of these transactions. Changes to
the L2 Block record are relevant, this being the only event that Client subscribes to (other than the rollback which
we will consider later)  Here is specifically how Client responds:

First, the event removals are created.  If a `BlockProposed` event is removed, then we need to mark the transactions
that were in that block (assuming they are 'our' transactions and therefore in the Client database) accordingly.

Removal of a block means that commitments and nullifiers which were on-chain (in the sense of being in a proposed block)
no longer are. Thus we update `.isOnChain` and `.isNullifiedOnChain` to `-1` (these properties hold a blockNumber
when set, so they're no simply boolean).

This is the simplest approach that we can take, but it's not the full story because the locally determine state
(`.isNullified`, `isPendingNullification`) is not reset.  That means that these commitments will not be reused
by Client in new transactions.  That's ok because eventually the transactions will be picked up again by a
Proposer and placed in a new block.  If we were to clear their internal state then they may be re-spent before
this happens.  That would create an invalid transaction.

A potential complication arises if dependent L2 transactions are taken off-chain.  This is because a Proposer
may attempt to re-incorporate them into a block in the wrong order (e.g. incorporating a transfer before the
deposit which enabled it).  If that happens, the dependent transaction will fail the Proposer's check and will
be dropped.  That's ok though because this mimics the behaviour that an L1 dependent transaction would experience in a
chain-reorganisation.

### Effect of Rollback events

Thus far, we have only considered the issue of `blockProposed` events being removed an replayed. However, we should also consider the
removal of a `rollback` event.

When a `rollback` happens, as the result of an existing challenge, all the L2 block hashes within the scope of a rollback will be removed from
the blockchain record.  Thus we might have the following:
```
H_0, H_1 ... H_p, H_q ... H_r ... H_n  before rollback

H_0, H_1 ... H_p after rollback
```
So the rollback removes all hashes later than `H_p` We then add new block hashes as the chain progresses:
```
chain 1: H_0, H_1 ... H_p, H'_q ... H'_r ... H'_t
```
Where the new block hashes are completely different from the old, removed ones, and the chain will generally be of a different length.
Now imagine a chain fork where the rollback never happened.  The chain looks like this:
```
chain 2: H_0, H_1 ... H_p, H_q ... H_r ... H_m
```
Suppose this is the heavier chain.  Thus, this will become the canonical chain when the reorganisation happens.  What happens to the
Layer 2 state in Optimist?

let's consider the actual transactions:
```
chain 1: propose(H_p), ...propose(H_r), ...propose(H_n), challenge(H_q), propose(H'_q), ...propose(H'_r), ...propose(H'_t)
chain 2: propose(H_p), ...propose(H_r), ...propose(H_n), ...propose(H_m)
```

First of all, removal events will be received.  This will remove the respective `proposeBlock` calls (`H'_q...H'_t`) from the L2 database (or,
more accurately it will set their L1 block number to null). Then the new 'chain 2' events will be played.  These will be the ones after `propose(H_n)`.
Then, the events that were removed will be re-mined. The re-mined `proposeBlocks` will revert because none of them can be attached after H_m.  However, the `challenge(H_q)` will succeed and will force a rollback to H_p.  
That is correct behaviour because all of the blocks after H_p on chain 2 are in fact invalid (because H_q is invalid).

