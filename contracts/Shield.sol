// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield_Computations.sol';

contract Shield is Shield_Computations{

  uint public acceptedProposals; // holds the nonce of the last accepted proposal + 1
  mapping(uint => uint) fee; //keeps track of each transaction's payment
  mapping(uint => bool) public challenges; // stores nonces of challenged proposals
  mapping(bytes32 => bool) public badRoots; // stores a list of roots that failed to make it into the state
  uint constant TRANSACTION_FEE = 0; // it's free for now!

  constructor(address _verifier) Shield_Computations(_verifier) public {
  }
  /*
  * Function to create and broadcast a deposit transaction
  */
  function deposit(
      bytes32 _publicInputHash,
      bytes32 ercAddress, // Take in as bytes32 for consistent hashing
      bytes32 _tokenId,
      bytes32 _value,
      bytes32 _commitment,
      uint256[] calldata _proof
    ) public payable returns(bool) {
    // gas measurement:
    uint256 gasCheckpoint = gasleft();
    // save the transaction in case it gets challenged
    bytes32[] memory c = new bytes32[](1); // TODO this is rather ugly
    c[0] = _commitment;
    Transaction memory transaction = Transaction({
      transactionNonce: transactionNonce,
      fee: msg.value,
      transactionType: TransactionTypes.DEPOSIT,
      transactionState: TransactionStates.PENDING,
      publicInputHash: _publicInputHash,
      root: '',
      tokenId: _tokenId,
      value: _value,
      ercAddress: ercAddress,
      commitments: c,
      nullifiers: new bytes32[](0),
      recipientAddress: '',
      proof: _proof
    });
    emitOptimisticTransaction(transaction);
    transactions[transactionNonce] = transaction;
    transactionNonce++;
    uint256 gasUsedByDeposit = gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByDeposit, gasUsedByDeposit);
    return true; // we don't need this but the super requires it
  }

  // test to see if the challenge is successful
  function runChallenge(RootProposal memory p) private returns(MerkleUpdate memory) {
    Transaction memory t = transactions[p.proofProposal.transactionNonce];
    // check the transaction type we're dealing with
    if (t.transactionType == TransactionTypes.DEPOSIT) {
      // run the shield computation in full and get the resulting state update
      return depositComputation(
        t.publicInputHash,
        t.ercAddress,
        t.tokenId,
        t.value,
        t.commitments[0],
        t.proof
      );
    }
  }


  // challenger challenges transaction
  function challenge(uint _proposalNonce) external {
    // store the nonce where the challenge was made
    challenges[_proposalNonce] = true;
    // TODO they need to pay for the transaction. As it stands, challenges are
    // too cheap.
  }

  // trigger acceptance of a valid proposal after 1 week
  function acceptNextProposal() external {
    MerkleUpdate memory m;
    RootProposal memory p = rootProposals[acceptedProposals];
    // it's possible that p doesn't exist if the proposal was invalid and has
    // been deleted.  If that's the case, there's nothing to do
    if (p.proofProposal.proposerAddress == address(0)) {
      emit RejectedProposedStateUpdate(acceptedProposals++);
      return;
    }
    require(now > p.blockTime + 1 weeks, 'Too soon to accept proposal' );
    // we can straight-away delete any proposal that is dependent on a proposal
    // that has already been successfully challenged
    if (badRoots[p.proofProposal.inputRoot]) {
      delete rootProposals[acceptedProposals];
      emit RejectedProposedStateUpdate(acceptedProposals++);
      return;
    }
    // this proposal is the next candidate to be incorporated into the Shield
    // state. Therefore, its input root must be known to the Shield contract.
    if (!roots[p.proofProposal.inputRoot]) {
      delete rootProposals[acceptedProposals];
      emit RejectedProposedStateUpdate(acceptedProposals++);
      return;
    }
    // next,check if someone has challenged this proposal
    if (challenges[acceptedProposals]) {
      // run the challenge and see if we get a valid state update back
      m = runChallenge(p);
      if (m.err || m.root != p.outputRoot) {
        // successful challenge
        // add the proposal's root to the naughty list
        badRoots[p.outputRoot] = true;
        // remove the proposal and don't add its state
        delete rootProposals[acceptedProposals];
        emit RejectedProposedStateUpdate(acceptedProposals++);
        return;
      }
    }
    // if not, update the state of the shield contract
    updateState(p, m);
    delete transactions[rootProposals[acceptedProposals].proofProposal.transactionNonce];
    delete rootProposals[acceptedProposals];
    emit AcceptedProposedStateUpdate(acceptedProposals++);
  }

  // Update the state of the Shield contract
  function updateState(RootProposal memory p, MerkleUpdate memory m) private {
    latestRoot = p.outputRoot;
    // update the root
    roots[latestRoot] = true;
    // update the nullifiers
    for (uint i = 0; i < p.proofProposal.nullifiers.length; i++)
      usedNullifiers[p.proofProposal.nullifiers[i]] = true;
    //update the FRONTIER
    frontier = m.frontier;
    // emit an event so that Timber updates its commitment database
    if (p.proofProposal.commitments.length == 1)
      emit NewLeaf(leafCount, p.proofProposal.commitments[0], latestRoot);
    if (p.proofProposal.commitments.length > 1)
      emit NewLeaves(leafCount, p.proofProposal.commitments, latestRoot);
    // update the number of Merkle tree leaves
    leafCount += p.proofProposal.commitments.length;
  }

  function emitOptimisticTransaction(Transaction memory t) private {
    emit OptimisticTransactionHeader(
      t.transactionNonce,
      t.fee,
      t.transactionType,
      t.transactionState
    );
    emit OptimisticTransactionBody(
      t.transactionNonce,
      t.publicInputHash,
      t.root,
      t.tokenId,
      t.value,
      t.ercAddress,
      t.commitments,
      t.nullifiers,
      t.recipientAddress,
      t.proof
    );
  }
}
