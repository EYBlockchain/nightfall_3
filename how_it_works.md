# How Nightfall zk optimistic rollup works

## Actors

There are three actors involved in the process:

- Transactors
- Proposers
- Challengers

A `Transactor` is a normal customer of the service. They wish to make `Transactions` i.e. Deposit,
Transfer, Withdraw. Anyone can be a Transactor. They pay a fee for the service.

A `Proposer` proposes new updates to the state of the Shield contract. By _state_, we mean
specifically the storage variables that are associated with a zkp transaction: nullifiers, and
commitment roots. Update proposals contain many `Transactions`, rolled up into a layer 2 `Block` and
only the final state, that would exist after all the Transactions in the Block were processed, is
stored. Anyone can become a Proposer but they must post a bond to do so. The bond is intended to
incentivise good behaviour. They must also stake some ETH every time they propose a block, which is
paid to a successful challenger. They make money by providing correct Blocks, collecting fees from
transactors. They are somewhat analogous to Miners in a conventional blockchain although the way
they operate is completely different.

A `Challenger` challenges the correctness of a proposal. Anyone can be a Challenger. They make money
from correct challenges.

_NB: Currently it's possible to front-run a challenge. We need to fix that._

## Contracts

The following contracts are relevant (others play no specific role in the optimistic rollup process
and have the same functionality as conventional nightfall).

- `Shield.sol` - this enables a user to submit a transaction for processing by a Proposer. If it's a
  deposit Transaction, it will take payment. It also allows anyone to request that the state of the
  Shield contract (commitment root and nullifier lists) is updated. When the state is updated, any
  withdrawals in the update will be processed (we don't yet allow immediate withdrawal; one needs to
  wait until a block is finalised).
- `Proposers.sol` - functionality for registering, deregistering, paying and rotating proposers.
- `Challenges.sol` - functionality to enable a Block to be challenged as incorrect in some way
  (there are several different ways a Block can be incorrect and, eventually this contract will
  cover all of them. For now, one can just challenge that the ZKP verifies and that the update to
  the commitment root is correct.
- `MerkleTree_Computations.sol` - A stateless (pure function) version of the original
  `MerkleTree.sol`, used by `Challenges.sol` to help compute challenged blocks on-chain.
- `Utils.sol` - collects together functionality which is either used in multiple contracts or which,
  if left inline, would affect readability of code.
- `Config.sol` - holds constants rather like a Nodejs config file.
- `Structures.sol` - defines global structs, enums, events, mappings and state variables. It makes
  these easier to find.

## Operation

We assume that several Proposers have registered with the system, posting a bond (I set this at 10
ETH) to do so.

### Transaction posting

The process starts with a Transactor creating a transaction by calling `submitTransaction` on
`Shield.sol`. The Transactor pays a fee to the Shield contract for the Transaction, which can be
anything the Transactor decides. Ultimately this will be paid to the Proposer that incorporates the
Transaction in a Block. The higher the fee, the more likely a Proposer is to pick up the
Transaction.

The Transaction call causes a Transaction event to be posted, containing the details of the
Transaction. If the Transaction is a Deposit, the Shield contract takes payment of the layer 1 ERC
token in question.

### Block assembly and submission

Proposers wait until the Shield contract assigns them as the current proposer (presently this is
done by simple rotation, I feel this should be random but I can't actually see a problem with
rotation).

The current proposer looks at the available Transactions and chooses one. Normally this would be the
one with the highest fee. They verify the proof and public inputs hash and compute the new
commitment Merkle-tree that _would_ come into being _were_ this transaction to be added to the
Shield contract next.

The current Proposer repeats this process n times, until they have assembled a Block, which contains
the hashes of the Transactions included in the Block and the commitment Merkle-tree root as it would
exist after processing all the transaction in the block (Commitment Root).

They then call `Proposers.proposeBlock(...)` and pass in the Block struct that they have just
assembled. The hash of this Block is then stored in a queue consisting of a linked-list of Block
hashes. They have to stake a `BLOCK_STAKE` to do this, which is additional to their bond.

### Challenges

The blocks will be in the queue for a week, during which time their correctness may be challenged by
calling one of the challenging functions in `Challenges.sol`. The challenger will need to pass in
Block struct and the Transaction structs that are contained in the block, because the blockchain
does not retain these. `Challenges.sol` will confirm this data against its stored Block hashes and
then do an on-chain computation to determin the correctness of the challenge (the details of the
computation being dependent on the type of challenge). The challenges that can be made are (not all
are yet implemented):

- PROOF_VERIFIES - the proof given in a transaction does not verify true;
- PUBLIC_INPUT_HASH_VALID - the public input hash of a transaction is not the correct hash of the
  public inputs;
- HISTORIC_ROOT_EXISTS - the root of the commitment Merkle Tree used to create the transaction proof
  has never existed;
- NULLIFIER_ABSENT - A nullifier, given as part of a Transaction is present in the list of spent
  nullifiers;
- NEW_ROOT_CORRECT - the given, updated commitment root that results from processing the
  transactions in the Block is not correct.

[...any others?]

Should the challenge succeed, i.e. the on-chain computation shows it to be a valid challenge, then
the following actions are taken by `Challenges.sol`:

- The hash of the Block in question is removed from the queue and the queue is spliced together at
  the point of removal;
- The Block stake, submitted by the Proposer, is paid to the Challenger;
- The Transactors with a Transaction in the Block are reimbursed the fee that they would have paid
  to the Proposer and any escrowed funds held by the Shield contract in the case of a Deposit
  transaction.
- The Proposer is delisted [what shall be do with their registration Bond? Do we need this?]

### State incorporation

Anyone can call the `Shield.updateShieldState(...)` function, passing in a Block and the
Transactions within that block. If the hash of that Block is at the head of the queue of Block
hashes, and it has been in the queue for more than a week, it will be removed from the queue and
incorporated into the Shield contract's state. From then on its transactions are finalised. The
state incorporation comprises:

- Validating the Block and its Transactions against the stored Block hash;
- Checking it is at the head of the queue and is more than a week old;
- Adding the Block's updated commitment root to the Shield's list of historic roots;
- Adding all the nullifiers in all the Transactions in the Block to the list of spent nullifiers;
- Broadcasting a newLeaves/newLeaf event;
- Updating the leafCount variable that Timber uses;
- Making the penultimate Block hash the new head of the queue and deleting the old head.
- Refunding the `BLOCK_STAKE` and paying the Transactor fees to the Proposer of the Block.

## Avoiding front-running attacks

It would be possible to front-run the Challenges described above. A front runner would simply submit
the Challenge before the original challenger. To fix this, we will use a commit-reveal strategy
(TODO).

The Challenger does not challenge immediately but provides a salted hash of the Challenge
information. This hash is saved against the sender's address.

Once that transaction has gone through, the Challenger sends the complete Challenge information
along with the salt. The contract then checks:

- the data sent is the pre-image of the hash, once the salt is added.
- the originating address is the same for both transactions

A front-runner would be alerted that a challenge has been made but would have to find the flawed
Block themselves and front-run before the challenge hash is written to the blockchain. This is not
completely impossible but they have very little time to find the flawed Block and so are unlikely to
succeed, or rather they have no more chance of succeeding than anyone else, which is fair game.
