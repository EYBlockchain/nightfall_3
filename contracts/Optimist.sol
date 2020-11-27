// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield.sol';

contract Optimist is Shield {
  struct Proposal {
    bytes32 latestRoot;
    uint nonce;
    bytes32[] commitments;
    bytes32[] nullifiers;
  } // a proposed new state for the Shield contract

  struct Transaction {
    uint nonce;
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
    uint nonce,
    uint fee,
    TransactionTypes transactionType,
    TransactionStates transactionState
  );

  event OptimisticTransactionBody(
    uint nonce,
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

  event ProposedTransaction(bytes32 _latestRoot, uint nonce, bytes32[] _commitments, bytes32[] _nullifiers);

  uint public nonce; // transaction nonce for ease of reference
  address public proposer; // can propose a new shield state
  mapping(address => bool) validators; // can validate a proposal
  mapping(uint => uint) fee; //keeps track of each transaction's payment
  Proposal currentProposal; // the current proposal
  mapping(address => address) voted; // keep track of who has voted (linke list)
  address private lastAddress;
  uint public validations; // how many validators have voted
  uint constant TRANSACTION_FEE = 0; // it's free for now!
  // mapping(uint => Transaction) public transactions;

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
    ) external payable override {
    // gas measurement:
    uint256 gasCheckpoint = gasleft();
    // save the transaction in case it gets challenged
    bytes32[] memory c = new bytes32[](1);
    c[0] = _commitment;
    Transaction memory t = Transaction({
      nonce: nonce,
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
    emitOptimisticTransaction(t);
    nonce++;
    uint256 gasUsedByDeposit = gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByDeposit, gasUsedByDeposit);
  }

  // proposer proposes new transaction
  function proposeTransaction(
    bytes32 _latestRoot,
    uint _nonce,
    bytes32[] calldata _commitments,
    bytes32[] calldata _nullifiers
  ) external onlyProposer {
    // root must not be empty/zero because we use this to check for a current proposal
    require(_latestRoot != '', 'root cannot be zero');
    // cannot create a new proposal until the previous one is dealt with
    require(currentProposal.latestRoot == 0, 'A proposal is already in progress');
    // to simplify things we take transactions in ascending nonce order
    // if that's all ok, we can submit a new proposal for the Shield state
    currentProposal = Proposal({
      latestRoot: _latestRoot,
      nonce: _nonce,
      commitments: _commitments,
      nullifiers: _nullifiers
    });
    emit ProposedTransaction(_latestRoot, _nonce, _commitments, _nullifiers);
  }

  // challenger challenges transaction
  function challenge(bytes32 _latestRoot) view external {
    require(currentProposal.latestRoot == _latestRoot, 'You can only challenge the current proposal');
  }

  // Update the state of the Shield contract
  function updateState() private {
    latestRoot = currentProposal.latestRoot;
    // update the root
    roots[latestRoot] = true;
    // update the nullifiers
    for (uint i = 0; i < currentProposal.nullifiers.length; i++)
      usedNullifiers[currentProposal.nullifiers[i]] = true;
    // TODO update the FRONTIER

    // emit an event so that Timber updates its commitment database
    if (currentProposal.commitments.length == 1)
      emit NewLeaf(leafCount, currentProposal.commitments[0], latestRoot);
    if (currentProposal.commitments.length > 1)
      emit NewLeaves(leafCount, currentProposal.commitments, latestRoot);
    // update the number of Merkle tree leaves
    leafCount += currentProposal.commitments.length;
  }
  // TODO
  function clear(mapping(address => address) storage _voted) private {}

  function emitOptimisticTransaction(Transaction memory t) private {
    emit OptimisticTransactionHeader(
      t.nonce,
      t.fee,
      t.transactionType,
      t.transactionState
    );
    emit OptimisticTransactionBody(
      t.nonce,
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
