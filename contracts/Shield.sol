// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield_Computations.sol';

contract Shield is Shield_Computations{

  uint public acceptedProposals; // holds the nonce of the last accepted proposal + 1
  mapping(uint => DepositTransaction) public depositChallenges; // stores nonces of challenged proposals
  mapping(bytes32 => bool) public badRoots; // stores a list of roots that failed to make it into the state

  constructor(address _verifier) Shield_Computations(_verifier) public {
  }
  /*
  * Function to create and broadcast a deposit transaction
  */
  function deposit(
    bytes32 publicInputHash,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32 commitment,
    uint[] calldata proof
  ) public payable {
    // gas measurement:
    uint256 gasCheckpoint = gasleft();
    // work out the hash of this data - we'll use that later to identify the tx
    bytes32 transactionHash = sha256(
      abi.encode(
        msg.value,
        publicInputHash,
        tokenId,
        value,
        ercAddress, // Take in as bytes32 for consistent hashing
        commitment,
        proof
      )
    );
    // broadcast this tx so a proposer can pick it up
    emit DepositTransactionCreated(
      transactionHash,
      msg.value,
      publicInputHash,
      tokenId,
      value,
      ercAddress,
      commitment,
      proof
    );
    // save the transactionHash for later identification
    transactionHashes[transactionHash] = true;
    uint256 gasUsedByDeposit = gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByDeposit, gasUsedByDeposit);
  }

  // challenger challenges transaction
  function challengeDeposit(
    uint _proposalNonce,
    uint fee,
    bytes32 publicInputHash,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32 commitment,
    uint[] calldata proof
  ) external {
    // compute the transactionHash
    bytes32 transactionHash = sha256(
      abi.encode(
        fee,
        publicInputHash,
        tokenId,
        value,
        ercAddress, // Take in as bytes32 for consistent hashing
        commitment,
        proof
      )
    );
    // data validation
    require (
      proposedStateUpdates[_proposalNonce].transactionHash == transactionHash,
      'The transaction hash does not correspond to the proposal being challenged'
    );
    DepositTransaction memory t = DepositTransaction({
      transactionHash: transactionHash,
      fee: fee,
      publicInputHash: publicInputHash,
      tokenId: tokenId,
      value: value,
      ercAddress: ercAddress, // Take in as bytes32 for consistent hashing
      commitment: commitment,
      proof: proof
    });
    // store the nonce where the challenge was made
    depositChallenges[_proposalNonce] = t;
    // TODO they need to pay for the transaction. As it stands, challenges are
    // too cheap.
  }

  // trigger acceptance of a valid proposal after 1 week
  function acceptNextProposal() external {
    MerkleUpdate memory m; // the updates computed, onchain, for the MerkleTree
    ProposedStateUpdate memory p = proposedStateUpdates[acceptedProposals];

    require(now > p.blockTime + 1 weeks, 'Too soon to accept proposal' );
    // next,check if someone has challenged this proposal
    if (depositChallenges[acceptedProposals].transactionHash != '') {
      // run the challenge and see if we get a valid state update back
      // (frontier[32] should be the root of the Merkle tree)
      DepositTransaction memory t = depositChallenges[acceptedProposals];
      m = depositComputation(
        t.publicInputHash,
        t.ercAddress,
        t.tokenId,
        t.value,
        t.commitment,
        t.proof
      );
      if (m.err || m.frontier[32] != p.frontier[32]) {
        // successful challenge
        emit RejectedProposedStateUpdate(acceptedProposals);
        acceptedProposals = p.blockEnd; // wipe out the entire remaining block
        // kill the proposer
        proposers[p.proposer] = false;
        return;
      }
    }
    // if not, update the state of the shield contract
    updateDepositState(p);
    delete depositChallenges[acceptedProposals];
    delete proposedStateUpdates[acceptedProposals];
    emit AcceptedProposedStateUpdate(acceptedProposals++);
  }

  // Update the state of the Shield contract
  function updateDepositState(ProposedStateUpdate memory p) private {
    latestRoot = p.frontier[32];
    // update the root
    roots[latestRoot] = true;
    //update the FRONTIER
    frontier = p.frontier;
    // update the number of leaves
    leafCount++;
    // emit an event so that Timber updates its commitment database
    emit NewLeaf(leafCount, p.frontier[0], latestRoot);
  }
}
