// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './Config.sol';
import './Utils.sol';
import './Structures.sol';

contract Proposers is Structures, Config {

  LinkedAddress public currentProposer; // can propose a new shield state
  uint proposerStartBlock; // L1 block where currentProposer became current
  uint public leafCount; // number of leaves in the Merkle treeWidth
  mapping(address => uint) public pendingWithdrawals;
  // mapping(bytes32 => LinkedHash) public blockHashes; //linked list of block hashes
  BlockData[] public blockHashes; // array containing mainly blockHashes
  mapping(address => LinkedAddress) public proposers;
  modifier onlyCurrentProposer() { // Modifier
    require(msg.sender == currentProposer.thisAddress, "Only the current proposer can call this.");
      _;
  }

  // getter for blockData
  function getBlockData(uint index) public view returns(BlockData memory) {
    return blockHashes[index];
  }

  /**
  * Each proposer gets a chance to propose blocks for a certain time, defined
  * in Ethereum blocks.  After a certain number of blocks has passed, the
  * proposer can be rotated by calling this function. The method for choosing
  * the next proposer is simple rotation for now.
  */
  function changeCurrentProposer() external {
    require(block.number - proposerStartBlock > ROTATE_PROPOSER_BLOCKS,
    "It's too soon to rotate the proposer");
    proposerStartBlock = block.number;
    currentProposer = proposers[currentProposer.nextAddress];
    emit NewCurrentProposer(currentProposer.thisAddress);
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

  //add the proposer to the circular linked list
  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender);
      proposers[msg.sender] = currentProposer;
      proposerStartBlock = block.number;
      emit NewCurrentProposer(currentProposer.thisAddress);
    } else {
      // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
      // assume current proposer is (x,A,z) address of this proposer is B
      LinkedAddress memory proposer; // proposer: (_,_,_)
      proposer.thisAddress = msg.sender; // proposer: (_,B,_)
      proposer.nextAddress = currentProposer.thisAddress;  // proposer: (_,B,A)
      proposer.previousAddress = currentProposer.previousAddress; // proposer: (x,B,A)
      proposers[currentProposer.previousAddress].nextAddress = proposer.thisAddress; // X: (u,v,B)
      proposers[currentProposer.thisAddress].previousAddress = proposer.thisAddress; // current: (B,A,z)
      currentProposer = proposers[currentProposer.thisAddress]; // ensure sync: currentProposer: (B,A,z)
      proposers[msg.sender] = proposer;
    }
  }
  function deRegisterProposer() external {
    //TODO - check they have no blocks proposed
    require(proposers[msg.sender].thisAddress != address(0), 'This proposer is not registered or you are not that proposer');
    proposers[msg.sender] = LinkedAddress(address(0), address(0), address(0)); // array will be a bit sparse
    //require(outstandingProposals[msg.sender] <= 0, 'You cannot withdraw your bond while you still have active proposals');
    pendingWithdrawals[msg.sender] = REGISTRATION_BOND;
  }
  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
  }

  function removeProposer(address proposer) internal {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
    if(proposer == currentProposer.thisAddress) {
      // Cannot just call changeCurrentProposer directly due to the require time check
      proposerStartBlock = block.number;
      currentProposer = proposers[nextAddress];
      emit NewCurrentProposer(currentProposer.thisAddress);
    }
  }
  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b, Transaction[] memory t) public view {
    bytes32 blockHash = Utils.hashBlock(b, t);
    require(blockHashes[b.blockNumberL2].blockHash == blockHash, 'This block does not exist');
  }
}
