// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;

import './Config.sol';
import './Utils.sol';
import './Structures.sol';
import './Proposers.sol';

contract Proposals is Structures, Config {

  Proposers public proposers;
  BlockData[] public blockHashes; // array containing mainly blockHashes
  uint public leafCount; // number of leaves in the Merkle treeWidth

  constructor(address proposersAddr) {
    proposers = Proposers(proposersAddr);
  }

  // getter for blockData
  function getBlockData(uint index) public view returns(BlockData memory) {
    return blockHashes[index];
  }

  function getBlockNumberL2() public view returns(uint) {
    return blockHashes.length;
  }

  modifier onlyCurrentProposer() { // Modifier
    require(msg.sender == proposers.getCurrentProposer(), "Only the current proposer can call this.");
      _;
  }

  /**
  * Allows a Proposer to propose a new block of state updates.
  * @param b the block being proposed.
  */
  function proposeBlock(Block calldata b, Transaction[] calldata t) external payable onlyCurrentProposer() {
    require(BLOCK_STAKE == msg.value, 'The stake payment is incorrect');
    // We need to check that the block has correctly stored its leaf count. This
    // is needed in case of a roll-back of a bad block, but cannot be checked by
    // a Challenge function (at least i haven't thought of a way to do it).

    // TODO it is probably cheaper just to set these, rather than test them
    require(b.leafCount == leafCount, 'The leaf count stored in the Block is not correct');
    require(b.blockNumberL2 == blockHashes.length, 'The block number stored in the Block is not correct');
    // We need to set the blockHash on chain here, because there is no way to
    // convince a challenge function of the (in)correctness by an offchain
    // computation; the on-chain code doesn't save the pre-image of the hash so
    // it can't tell if it's been given the correct one as part of a challenge.
    // To do this, we simply hash the function parameters because (1) they
    // contain all of the relevant data (2) it doesn't take much gas.
    bytes32 blockHash = keccak256(msg.data[4:]);
    //bytes32 blockHash = Utils.hashBlock(b, t);
    // All check pass so add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data plus the absolute minimum of metadata - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.
    blockHashes.push(BlockData({
      blockHash: blockHash,
      time: block.timestamp
    }));
    // Timber will listen for the BlockProposed event as well as
    // nightfall-optimist.  The current, optimistic version of Timber does not
    // require the smart contract to craft NewLeaf/NewLeaves events.
    leafCount += b.nCommitments;
    emit BlockProposed();
  }

  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b, Transaction[] memory t) public view {
    bytes32 blockHash = Utils.hashBlock(b, t);
    require(blockHashes[b.blockNumberL2].blockHash == blockHash, 'This block does not exist');
  }

  function removeProposer(address proposer, address challenger) public {
    proposers.removeProposer(proposer);
    proposers.addToPendingWithdrawals(challenger, BLOCK_STAKE);
  }

}
