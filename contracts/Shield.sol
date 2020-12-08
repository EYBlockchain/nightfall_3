// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield_Computations.sol';

contract Shield is Shield_Computations{

  // This struct holds a deposit transaction that has been challenged, together
  // with the address of the challenger
  struct DepositTransactionChallenge{
    DepositTransaction depositTransaction;
    address challenger;
  }

  uint public acceptedProposals; // holds the nonce of the last accepted proposal + 1
  mapping(uint => DepositTransactionChallenge) private depositChallenges; // stores nonces of challenged proposals
  mapping(bytes32 => bool) public badRoots; // stores a list of roots that failed to make it into the state
  mapping(address => bytes32) public challengeHashes; // stores challenge commitments as part of the front-running defence

  uint constant CHALLENGE_DEPOSIT_STAKE = 1 ether;

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
    require(msg.value > 0, 'The payment offered may be small, but not zero');
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
    // save the transactionHash for later identification (also a handy way to
    // remember the fee offered)
    transactionHashes[transactionHash] = msg.value;
    uint256 gasUsedByDeposit = gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByDeposit, gasUsedByDeposit);
  }

  function commitToChallenge(bytes32 challengeHash) external {
    challengeHashes[msg.sender] = challengeHash;
  }

  // challenger challenges transaction
  function challengeDeposit(
    bytes32 challengeSalt,
    bytes32 challengeHash,
    uint _proposalNonce,
    uint fee,
    bytes32 publicInputHash,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32 commitment,
    uint[] calldata proof
  ) external payable {
    // check we're not being front-run
    bytes32 challengeHashExpected = sha256(abi.encode(
      challengeSalt,
      _proposalNonce,
      fee,
      publicInputHash,
      tokenId,
      value,
      ercAddress,
      commitment,
      proof
    ));
    require(challengeHashExpected == challengeHash, 'The challenge hash does not match');
    require(challengeHashes[msg.sender] == challengeHash, 'The origins of the commitment and the reveal are not the same');
    // we can only allow one challenger per proposal
    require(
      depositChallenges[_proposalNonce].challenger == address(0),
      'This proposal has already been challenged'
    );
    // You have to pay to challenge.  You get it back about x10 if you are
    // correct, else you lose it!
    require(msg.value == CHALLENGE_DEPOSIT_STAKE, 'Incorrect stake sent');
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
    DepositTransactionChallenge memory c = DepositTransactionChallenge({
      depositTransaction: t,
      challenger: msg.sender
    });
    // store the details of the challenge was made
    depositChallenges[_proposalNonce] = c;
  }

  /**
  * This function allows someone to trigger acceptance of a ste-update proposal
  * after 1 week has elapsed.  It will simply taken the next proposal in
  * sequence (sequence is defined by ascending proposalNonce) that has not yet
  * been added to the Shield contract state.
  * The function will check if the candidate proposal has been challenged and,
  * if it has, it will do a full on-chain proof verification and merkle-tree
  * update computation.  If the challenge fails (i.e. the proposal was correct)
  * the proposal will be added to the shield contract.  If not, that proposal
  * and any remaining proposal in the submitted block will be ignored and the
  * proposer will be punished by being removed from the proposers' list and
  * their stake paid to the challenger. TODO decide what to do with the
  * challengers stake in the event of an incorrect challenge.
  */
  function acceptNextProposal() external {
    MerkleUpdate memory m; // the updates computed, onchain, for the MerkleTree
    ProposedStateUpdate memory p = proposedStateUpdates[acceptedProposals];

    require(now > p.blockTime + 1 weeks, 'Too soon to accept proposal' );
    // next,check if someone has challenged this proposal
    if (depositChallenges[acceptedProposals].depositTransaction.transactionHash != '') {
      // run the challenge and see if we get a valid state update back
      // (frontier[32] should be the root of the Merkle tree)
      DepositTransaction memory t = depositChallenges[acceptedProposals].depositTransaction;
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
        proposers[currentProposerIndex-1] = address(0);
        // give all the bond to the challenger.
        pendingWithdrawals[depositChallenges[acceptedProposals].challenger] += REGISTRATION_BOND;
        return;
      }
    }
    // if not, update the state of the shield contract
    updateDepositState(p);
    // pay the proposer and clean up
    pendingWithdrawals[p.proposer] += p.fee;
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
