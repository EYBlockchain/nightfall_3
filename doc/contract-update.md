# Updating contracts

We may need to update contracts, for example to fix a bug. This creates a degree of
centralisation but is an acceptable tradeoff for a beta phase.

## Considerations

If we move to a new set of contracts then we need to ensure that:

1. Any stored state is copied over so that users retain their commitments and the contract
correctly holds nullifiers etc.
1. Any re-syncing `optimist` or `client` is able to parse calldata originating from the
current contract and earlier ones.
1. Updates to the old contract are stopped before the changeover happens.
1. Nightfall and clients should be able to discover the new contract address.
1. Service disruption should be minimised.

Note: We assume that the contracts' ABIs are not changing. If they do change, then the
Nightfall components will also need upgrading and re-syncing. That is a conventional upgrade though.

## Solution

First we need to signal to users that this contract is deprecated and will be destroyed (`selfdestruct`)
soon. This should be done by emitting an event `Deprecated`, which will list the addresses of the
deprecated contracts, and should be about 150 blocks (10 mins) before the `upgrade` function is called.
This is because the `upgrade` function will selfdestruct the `State`, `Shield`, `Proposers` and `Challenges`
contracts and any ETH sent to those contracts (e.g. by a Proposer registration) will be lost (actually
the address owner could repay them so it's maybe not a total disaster). Thus Proposers, Challengers and
Users should check for such an event immediately before sending ETH and, if found, they should wait until
they see a `ContractsUgraded` event (see below), at which point they should update their contract addresses
with a write to the `build` volume.

After sufficient time has passed, and assuming a new set of contracts is deployed, the `upgrade` function
should be called.  This is an `onlyOwner` function in `State.sol` that will, atomically, do the following:
1. Copy the address of the current `State`, `Shield`, `Proposers` and `Challenges` contracts to the new `State` contract.
These will be stored to assist devices that are syncing, and which will need to sync call data emitted by both old
and new contracts.
1. Write the current block number into the new `State` contract. Again, this will help syncing devices
to know which events to listen for (specifically the Event's address).
1. Copy all storage variables to the new contract (including the addresses of any previous contracts, if these exist);
1. Emit an event `ContractsUgraded` which broadcasts the addresses of the new `State`, `Shield`, `Proposers`
and `Challenges` contracts;
1. Call `selfdestruct` on `State`, `Shield`, `Proposers` and `Challenges` contracts, paying the Ether held by
`State` into the new `State` contract.

The syncing functions in `Optimist`, `Client` and `Nightfall-browser` must be modified to cope with
syncing across different contract addresses, swapping contracts at particular block numbers.
