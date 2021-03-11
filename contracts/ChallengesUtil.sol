
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {
  function libChallengeProofVerifies(
    Structures.Block memory blockL2,
    Structures.Transaction memory transaction,
    uint transactionIndex, // the location of the transaction in the block (saves a loop)
    uint256[] memory vk
  ) public returns (bool){
    require(
      blockL2.transactionHashes[transactionIndex] == Utils.hashTransaction(transaction),
      'This transaction is not in the block at the index given'
    );
    require(!Verifier.verify(
        transaction.proof,
        uint256(transaction.publicInputHash),
        vk),
      'This proof appears to be valid'
    );
    return true;
  }

  function getPath(bytes32[] memory commitmentsPriorBlock, bytes32[33] calldata frontierPriorBlock, uint leafCount, bytes32 root ) pure internal returns (bool,bytes32[33] memory){
      (bool valid, bytes32[33] memory _frontier) = MerkleTree_Stateless.checkPath(
      commitmentsPriorBlock,
      frontierPriorBlock,
      leafCount,
      root
    );
    return (valid,_frontier);
  }

  function libChallengeNewRootCorrect(
    Structures.Block memory priorBlockL2, // the block immediately prior to this one
    Structures.Transaction[] memory priorBlockTransactions, // the transactions in the prior block
    bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
    Structures.Block memory blockL2,
    Structures.Transaction[] memory transactions,
    uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
  ) public pure returns (bool){
  uint nCommitmentsPriorBlock;
  for (uint i = 0; i < priorBlockTransactions.length; i++) {
    require(
      priorBlockL2.transactionHashes[i] == Utils.hashTransaction(priorBlockTransactions[i]),
      'Transaction hash was not found'
    );
    nCommitmentsPriorBlock += priorBlockTransactions[i].commitments.length; // remember how many commitments are in the block
  }

  //calculate the number of commitments in prior block
  bytes32[] memory commitmentsPriorBlock = new bytes32[](nCommitmentsPriorBlock);
  uint l;
  for (uint i = 0; i < priorBlockTransactions.length; i++) {
    for (uint j = 0; j < priorBlockTransactions[i].commitments.length; j++)
      commitmentsPriorBlock[l++] = priorBlockTransactions[i].commitments[j];
  }
  // next check the sibling path is valid and get the Frontier
  (bool valid, bytes32[33] memory _frontier) = getPath(commitmentsPriorBlock, frontierPriorBlock,priorBlockL2.leafCount, priorBlockL2.root);
  
  require(valid, 'The sibling path is invalid');

  uint nCommitments;
    for (uint i = 0; i < transactions.length; i++) {
      require(
        blockL2.transactionHashes[i] == Utils.hashTransaction(transactions[i]),
        'Transaction hash was not found'
      );
      nCommitments += transactions[i].commitments.length; // remember how many commitments are in the block
    }

    // next, let's get all the commitments in the block, togther in an array
    // we could do this with less code by making commitments 'storage' and pushing to the end of the array but it's a waste of Gas because we don't want to keep the commitments.
    bytes32[] memory commitments = new bytes32[](nCommitments);
    uint k;
    for (uint i = 0; i < transactions.length; i++) {
      for (uint j = 0; j < transactions[i].commitments.length; j++)
        commitments[k++] = transactions[i].commitments[j];
    }
    // At last, we can check if the root itself is correct!
    (bytes32 root, , ) = MerkleTree_Stateless.insertLeaves(commitments, _frontier, commitmentIndex);
    require(root != blockL2.root, 'The root is actually fine');

    return true;
  }
}