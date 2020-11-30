// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield.sol';

contract Optimist is Shield {
  struct Proposal {
    uint proposalNonce;
    uint blockTime;
    bytes32 latestRoot;
    uint transactionNonce;
    bytes32[] commitments;
    bytes32[] nullifiers;
  } // a proposed new state for the Shield contract

  struct Transaction {
    uint transactionNonce;
    uint fee;
    TransactionTypes transactionType;
    TransactionStates transactionState;
    bytes32 publicInputHash;
    bytes32 root;
    bytes32 tokenId;
    bytes32 value;
    bytes32 ercAddress;
    bytes32[] commitments;
    bytes32[] nullifiers;
    bytes32 recipientAddress;
    uint[] proof;
  }
// event is split into two because otherwise we get a Stack Too Deep error
  event OptimisticTransactionHeader(
    uint transactionNonce,
    uint fee,
    TransactionTypes transactionType,
    TransactionStates transactionState
  );

  event OptimisticTransactionBody(
    uint transactionNonce,
    bytes32 publicInputHash,
    bytes32 root,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32[] commitments,
    bytes32[] nullifiers,
    bytes32 recipientAddress,
    uint256[] proof
  );

  event ProposedStateUpdate(
    uint proposalNonce,
    uint blockTime,
    bytes32 _latestRoot,
    uint transactionNonce,
    bytes32[] _commitments,
    bytes32[] _nullifiers
  );

  uint public transactionNonce; // transaction nonce for ease of reference
  uint public proposalNonce;
  uint public acceptedProposals; // holds the nonce of the last accepted proposal + 1
  address public proposer; // can propose a new shield state
  mapping(uint => uint) proposalNonces; //holds the next proposal nonce for
  // a given challengeNonce siding.
  mapping(uint => uint) fee; //keeps track of each transaction's payment
  mapping(uint => Proposal) proposals; // PENDING proposals
  mapping(uint => Transaction) public transactions;
  mapping(uint => bool) public challenges; // stores nonces of challenged proposals
  uint constant TRANSACTION_FEE = 0; // it's free for now!

  enum TransactionStates { PENDING, PROPOSED, ACCEPTED, REJECTED }

  constructor(address _verifier) Shield(_verifier) public {
  }

  modifier onlyProposer() { // Modifier
    require(msg.sender == proposer, "Only proposer can call this.");
      _;
  }

  function deposit(
      bytes32 _publicInputHash,
      bytes32 ercAddress, // Take in as bytes32 for consistent hashing
      bytes32 _tokenId,
      bytes32 _value,
      bytes32 _commitment,
      uint256[] calldata _proof
    ) public payable override returns(bool) {
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
    return true;
  }

  // proposer proposes new transaction
  function proposeStateUpdate(
    bytes32 _latestRoot,
    uint _transactionNonce,
    bytes32[] calldata _commitments,
    bytes32[] calldata _nullifiers
  ) external onlyProposer {
    // Let's check the transaction being proposed is in the PENDING state
    require(transactions[transactionNonce].transactionState == TransactionStates.PENDING, "This transaction's state is not PENDING");
    // now, if there has been a challenge it may be that this proposer has
    // computed that the challenge will be successful. If that is the case, the
    // state they are proposing will be valid from the point at which the
    // challenge succeeds and all the proposed states are rolled back to the
    // point of the challenge. They indicate this by setting the challengeNonce
    // to the value of the nonce of the last valid transaction + 1
    // otherwise they set the challengeNonce to zero.
    // in such a case we don't add them to the main proposal queue but put them
    // into a numbered siding (siding 0 is defined as the main queue)
    // This makes them a bit harder to refer to in a mapping because they don't
    // have a unique proposalNonce anymore. So we need a double mapping.
    // proposal = proposals[challengeNonce][proposalNonce]
    Proposal memory proposal = Proposal({
      proposalNonce: proposalNonce++,
      blockTime: now,
      latestRoot: _latestRoot,
      transactionNonce: _transactionNonce,
      commitments: _commitments,
      nullifiers: _nullifiers
    });

    proposals[proposal.proposalNonce] = proposal;

    emit ProposedStateUpdate(
      proposal.proposalNonce,
      proposal.blockTime,
      proposal.latestRoot,
      proposal.transactionNonce,
      proposal.commitments,
      proposal.nullifiers
    );
    transactions[transactionNonce].transactionState = TransactionStates.PROPOSED;
  }

  // trigger acceptance of a valid proposal after 1 week
  function acceptNextProposal() external {
    require(now > proposals[acceptedProposals].blockTime + 1 weeks, 'Too soon to accept proposal' );
    // first, check if someone has challenged this proposal
    bool successfulChallenge = false;
    if (challenges[acceptedProposals]) successfulChallenge = runChallenge(acceptedProposals);
    // if not, update the state of the shield contract
    if (!successfulChallenge) updateState(acceptedProposals);
    delete transactions[proposals[acceptedProposals].transactionNonce];
    delete proposals[acceptedProposals];
    acceptedProposals++;
  }

  // test to see if the challenge is successful
  function runChallenge(uint _proposalNonce) private returns(bool) {
    Proposal memory p = proposals[_proposalNonce];
    Transaction memory t = transactions[p.transactionNonce];
    if (t.transactionType == TransactionTypes.DEPOSIT) {
      if (super.deposit(
        t.publicInputHash,
        t.ercAddress, // Take in as bytes32 for consistent hashing
        t.tokenId,
        t.value,
        t.commitments[0],
        t.proof
      )) {
        if (latestRoot == p.latestRoot) {
          // success block - this means the challenge failed (!).
          //
          // the state will have been updated so nothing more to do other than
          // make sure the challenger pays for wasting peoples' time
          // TODO challenger pays somehow
          return false;
        } else {
          // the proof verified but the proposed root was wrong
          // This invalidates all proposal in train except for the one that is
          // the subject of the challenge.
        }
      } else {
        // the proof did not verify
        // oh dear, this is a right old caffufle. The failure invalidates all
        // proposals that are in train including the one that was challenged.
        // So we may as well ditch those.
        for (uint i = acceptedProposals; i < proposalNonce; i++) {
          delete proposals[i];
        }
        // However if any proposers have already taken this successful challenge
        // into account, we can add in their
      }
    }
  }


  // challenger challenges transaction
  function challenge(uint _proposalNonce) external {
    /* call the base shield contract (super) transaction which will do a
    * conventional blockchain transaction. There are a few cases to treat:
    * 1 - the super transaction goes through and the new root is as proposed
    * 2 - the super transaction goes through but the MerkleTree contract does
    *     not agree on the root (its determination must be correct of course)
    * 3 - the super transaction fails.
    *
    * In the case (1), there is nothing more to do, except that the root will
    * be wrong if this proposal is evaluated out of sequence.  This tells us
    * that challenges should be held until the point where the proposal is about
    * to be accepted into the Shield state. We have to do this anyway because
    * the proposal may have a dependendency on proposals that are ahead of it
    * in the queue.
    * In case 2 all extant proposals will now be invalid. If we do nothing else,
    * this is an issue because now everyone must wait another week for their
    * transactions to be confirmed. In fact no proposer will make proposals
    * knowing they will be invalidated, so no one will even have their
    * transactions picked up.
    * To fix this, broadcast the challenge as soon as the challenge is made.
    * ...TODO more here
    */
    // store the nonce where the challenge was made
    challenges[_proposalNonce] = true;
    // TODO they need to pay for the transaction. As it stands, challenges are
    // too cheap.
  }

  // Update the state of the Shield contract
  function updateState(uint _proposalNonce) private {
    Proposal memory proposal = proposals[_proposalNonce];
    latestRoot = proposal.latestRoot;
    // update the root
    roots[latestRoot] = true;
    // update the nullifiers
    for (uint i = 0; i < proposal.nullifiers.length; i++)
      usedNullifiers[proposal.nullifiers[i]] = true;
    // TODO update the FRONTIER

    // emit an event so that Timber updates its commitment database
    if (proposal.commitments.length == 1)
      emit NewLeaf(leafCount, proposal.commitments[0], latestRoot);
    if (proposal.commitments.length > 1)
      emit NewLeaves(leafCount, proposal.commitments, latestRoot);
    // update the number of Merkle tree leaves
    leafCount += proposal.commitments.length;
  }

  // TODO
  function clear(mapping(address => address) storage _voted) private {}

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
