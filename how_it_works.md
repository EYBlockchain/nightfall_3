# How Nightfall zk optimistic rollup works

## Actors

There are three actors involved in the process:

- Transactors
- Proposers
- Challengers

A `Transactor` is a normal customer of the service. They wish to make `Transactions` i.e. Deposit,
Transfer, Withdraw. Anyone can be a Transactor. They pay a fee for the service.

A `Proposer` proposes new updates to the state of the Shield contract (a `Proposal`). By _state_, we
mean specifically the storage variables that are associated with a zkp transaction: nullifiers,
roots, commitments and the Timber Merkle-tree Frontier (in fact the Frontier actually contains the
last root and commitment so separate root and commitment updates are not needed). Anyone can become
a Proposer but they must post a bond to do so. The bond is intended to incentivise good behaviour.
They make money by providing correct proposals. They are somewhat analogous to Miners in a
conventional blockchain although the way they operate is completely different.

A `Challenger` challenges the correctness of a proposal. Anyone can be a Challenger but they must
stake some ETH to make a `Challenge`. This is to prevent frivolous challenges. They make money for
correct challenges.

_NB: Currently it's possible to front-run a challenge. We need to fix that._ [EDIT - now fixed, see
front-running section below]

## Contracts

The following contracts are relevant (others play no specific role in the optimistic rollup process
and have the same functionality as conventional nightfall).

- `Shield.sol` - this has the optimist deposit, transfer, withdraw, state update and challenge
  functionality.
- `Proposal.sol` - structs for a state update proposal and functionality for registering,
  deregistering, paying and rotating proposers.
- `Shield_Computations.sol` - does a full on-chain verification and public inputs hash check, and
  calls `MerkleTree_Computations.sol` to compute the Merkle tree state update.
  `Shield_Computations.sol` is called by the Shield contract when a Challenge forces on-chain
  computation. Note that although `Shield_Computations.sol` and `MerkleTree_Computations.sol`
  _compute_ the state update between them, they do not _store_ it. Instead they pass back a
  `MerkleTreeUpdate` struct, which contains the state update data (the new Timber frontier and the
  results of the public inputs hashing check and the proof verification), to the Shield contract.
  The Shield contract then does the state update.
- `Transactions.sol` - contains structs and events associated with Transactions.

## Operation

We assume that several Proposers have registered with the system, posting a bond (I set this at 10
ETH) to do so.

The process starts with a Transactor creating a transaction by calling `deposit`, `transfer` or
`withdraw` on `Shield.sol`. [NB currently only `Deposit` is implemented but the other functions will
work in the same way]. The Transactor pays a fee to the Shield contract for the transaction, which
can be anything the Transactor decides (but greater than 0 because 0 is reserved for other uses).
The transaction call causes a transaction event to be posted, containing the details of the
transaction.

Proposers wait until the Shield contract assigns them as the current proposer (presently this is
done by simple rotation, I feel this should be random but I can't actually see a problem with
rotation).

The current proposer looks at the available transactions and chooses one. Normally this would be the
one with the highest fee. They verify the proof and public inputs hash and compute the new
Merkle-tree and nullifier-list states, that _would_ come into being _were_ this transaction to be
added to the Shield contract next. The Merkle tree state update is sufficiently represented by a
`Timber Frontier` update and the nullifier list is unchanged by a Deposit.

The current Proposer bundles all this information, along with some metadata, up into a struct
(actually they don't _really_ make a struct because you can't pass structs into solidity, so they
just save up the data, but I like to think of it as a struct because the contract keeps it as a
struct internally).

The current proposer then chooses another transaction and creates another Proposal, building its
state on top of the previous Proposal. They keep doing this until they run out of time or
Transactions to propose (they get to be current proposer for a certain number of blocks). They then
call `Proposals.proposeStateUpdatesBlock(...)` and pass in the Proposal data, correctly ordered in
arrays of state updates and transactions (actually just hashes of the transactions to save storage).
This data constitutes a `Layer 2 Block`. The Proposals are given an incrementing sequence number by
the Proposals contract, called a proposalNonce. This is used both as a unique identifier and to keep
the proposals in the correct order: the state update described by a Proposal is a function of the
current state of the Shield contract and all of the updates to that state described by the Proposals
between the Shield contract state and the Proposal in question, so correct order is vital.

`Shield state <- Proposal r <- Proposal r+1 <- Proposal r+2....<- Proposal n`

Proposals can be added to the Shield contract state after they have existed for 1 week. This is done
by calling `Shield.acceptNextProposal()`. Note there is no input parameter: the 'next' Proposal is
determined solely by the proposalNonce. The function will add the next proposal, provided it is more
than one week old and has not been the subject of a challenge. The 'next' proposal is kept track of
by the state variable `acceptedProposals`. This points to the `proposalNonce` of the _next_ Proposal
due to be added (`Proposal r` in the above diagram; the counting is like array slices). Anyone can
call `Shield.acceptNextProposal()` but, for anyone other than a Proposer or Transactor, this would
be a waste of Gas [To consider - do I call it or do I wait and hope someone else calls it? How does
that play out?].

Once a Proposal is added to the Shield contract, the Proposer is paid the fee proposed by the
Transactor for the Transaction contained in the Proposal. This is how they make their money.

At any time during the week a Proposal may be challenged. Once its state is added to the Shield
contract, it is too late to challenge.

If a challenge is made, nothing happens at the point of challenge, the challenge data is simply
recorded in a list. Challengers have to stake some money (1 ETH) to prevent frivolous Challenges as
the gas costs of a challenge are low. Only when a Proposal is about to be added to the Shield
contract state by `Shield.acceptNextProposal()` is the list of Challenges examined. If there is one
that references the proposalNonce of the about-to-be-added proposal (`= acceptedProposals`), then a
full on-chain Transaction is computed.

If the results of that on-chain computation match the proposal, the Challenge has failed. The
Challenger loses their stake and the Proposal is added to the Shield contract [To consider; what do
we do with that stake? Do we keep it and buy a massive yacht?]. If the results do not match, then
the Challenge is successful. The guilty Proposer is de-listed and their bond is paid to the
Challenger. The bond is much more than the stake, so that's how the Challenger makes their money.
The state of the flawed Proposal is not added to the Shield contract and neither is the state of any
remaining Proposals in the ex-Proposer's Layer 2 Block, because these are assumed to depend on the
flawed Proposal. This is accomplished simply by moving the `acceptedProposals` pointer to the end of
the Layer 2 Block.

We hope that the Proposer of the next block will have spotted the bad block and will have built
their block on good state (probably issuing a Challenge too). If not (perhaps because the flawed
block was challenged after they build their block on top and they didn't do any checks) they will
almost certainly be challenged because a Challenger is likely to check Layer 2 Blocks that are
upstream of their challenge point. A Proposer will be reasonably safe if they check a few blocks
ahead, in the assumption that other Proposers will do likewise. This means that a current Proposer
should check some previous blocks as well as assemble their own block.

Imagine though, what would happen if Proposers continue to build on bad state. Eventually someone
will challenge the flawed block and, fairly quickly, a string of Challenges will be created as
Challengers check Layer 2 Blocks upstream of the original Challenge (they'll realise that Proposers
might build on the bad block and so will prioritise checking subsequent blocks). The Proposers will
see what is happening and will stop adding Blocks until they have computed the extent of the bad
state. In practice, Proposers will probably do this as soon as the first Challenge is issued because
they'll be worried that subsequent blocks may also be flawed and they'll get penalised if they build
on top. They will then start building good blocks by ignoring the bad state. Thus, the approach is
self-correcting. We will probably arrange things so that Proposers of subsequent bad blocks do not
get penalised so heavily as the Proposer of the first bad block but Challengers still get a
(reduced) reward, although this is not currently implemented.

We could, of course, tear up _all_ of the blocks that were upstream of a successful Challenge, but
that would mean we'd need to wait a week before we could add any more state to the Shield contract.
That would work, and people would still be able to transact in the meantime, but it seems wasteful
if there's a reasonable chance some of those blocks are good.

A Transactor who loses their transaction because it was in a bad block, will get their fee refunded
but will have to resubmit their Transaction.

## Avoiding front-running attacks

It would be possible to front-run the Challenges described above. A front runner would simply submit
the Challenge before the original challenger. To fix this, we use a commit-reveal strategy.

The Challenger does not challenge immediately but provides a salted hash of the Challenge
information. This hash is saved by `Shield.sol` against the sender's address. Once that transaction
has gone through, the Challenger sends the complete Challenge information along with the salt.
Shield.sol then checks:

- the data sent is the pre-image of the hash, once the salt is added.
- the originating address is the same for both transactions

A front-runner would be alerted that a challenge has been made but would have to find the flawed
Proposal themselves and front-run before the challenge hash is written to the blockchain. This is
not completely impossible but they have very little time to find the flawed Proposal and so are
unlikely to succeed. It would also be possible to create obfuscating transactions if needed. [To
consider: is this sufficient, a front-runner who has a server checking Proposals could just delay
competitors enough so that they get their Challenge in first?]
