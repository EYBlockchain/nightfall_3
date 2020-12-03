// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.6.0;

import './Transactions.sol';

contract Proposals is Transactions {
  // propose a new transaction proof
  struct ProofProposal {
    uint proposalNonce;
    address proposerAddress;
    bytes32 inputRoot;
    uint transactionNonce;
    bytes32[] commitments;
    bytes32[] nullifiers;
  }

  // propose a new Merkle root
  struct RootProposal {
    uint proposalNonce;
    uint blockTime;
    bytes32 outputRoot;
    ProofProposal proofProposal;
  }

  event ProofProposed(
    uint proposalNonce,
    address proposerAddress,
    bytes32 inputRoot,
    uint transactionNonce,
    bytes32[] _commitments,
    bytes32[] _nullifiers
  );

  event RootProposed(
    uint proposalNonce,
    uint blockTime,
    bytes32 _outputRoot
  );

  event RejectedProposedStateUpdate(
    uint proposalNonce
  );

  event AcceptedProposedStateUpdate(
    uint proposalNonce
  );

  address public proposer; // can propose a new shield state
  uint public proposalNonce;
  mapping(uint => ProofProposal) proofProposals; // PENDING proof Proposals
  mapping(uint => RootProposal) rootProposals; // pending root proposals


  modifier onlyProposer() { // Modifier
    require(msg.sender == proposer, "Only proposer can call this.");
      _;
  }

  /*
  * Allows a Proposer to propose a new transaction proof.  This has to be done
  * separately from proposing a new MerkleTree root because it takes ages to
  * calculate, and a proposer is only in a position to compute a root when they
  * are next in line to add a proposal. We don't want to have to wait for them
  * to compute a proof at that point.  If we just let them compute a proof and
  * not propose it, then we have the problem that several people might
  * incorporate the same transactions into their proposals. They won't find out
  * until it's too late and they have no time to compute a fresh proof before
  * they have to propose one.
  */
  function proposeProof(
    uint _transactionNonce,
    bytes32[] calldata _commitments,
    bytes32[] calldata _nullifiers
  ) external onlyProposer {
    // Let's check the transaction being proposed is in the PENDING state
    require(transactions[transactionNonce].transactionState == TransactionStates.PENDING, "This transaction's state is not PENDING");
    ProofProposal memory proposal = ProofProposal({
      proposalNonce: proposalNonce++,
      proposerAddress: msg.sender, // ensures someone can't nick this proposal
      inputRoot: transactions[transactionNonce].root,
      transactionNonce: _transactionNonce,
      commitments: _commitments,
      nullifiers: _nullifiers
    });
    proofProposals[proposal.proposalNonce] = proposal;
    emit ProofProposed(
      proposal.proposalNonce,
      proposal.proposerAddress,
      proposal.inputRoot,
      proposal.transactionNonce,
      proposal.commitments,
      proposal.nullifiers
    );
    transactions[transactionNonce].transactionState = TransactionStates.PROPOSED;
  }

  /*
  * Function that lets a Proposer propose an 'output' root.  This is what would
  * be the Merkle tree root, once the proposal was accepted into the Shield
  * contract state.  It's only possible to calculate this once the order in
  * which this proposal will be accepted into the shield contract is known. Thus
  * it's done separately, after the zk snark proof is proposed. This
  * function joins up the two parts of the proposal into a single
  * 'rootProposal'.
  */
  function proposeRoot (
    uint _proposalNonce,
    bytes32 _outputRoot
  ) external onlyProposer {
    // a few checks
    require(
      proofProposals[_proposalNonce].proposerAddress != address(0),
      'There is no corresponding proof proposal'
    );
    require(
      proofProposals[_proposalNonce].proposerAddress == msg.sender,
      'This sending address did not originate the corresponding proposal proof'
    );
    RootProposal memory proposal = RootProposal({
      proposalNonce: _proposalNonce,
      outputRoot: _outputRoot,
      blockTime: now,
      proofProposal: proofProposals[_proposalNonce]
    });
    rootProposals[proposal.proposalNonce] = proposal;
    emit RootProposed(
      proposal.proposalNonce,
      proposal.blockTime,
      proposal.outputRoot
    );
    // we no longer need the proof Proposal as we've incorporated it in the
    // root proposal
    delete proofProposals[_proposalNonce];
  }
}
