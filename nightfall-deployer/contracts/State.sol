// SPDX-License-Identifier: CC0-1.0

/**
Contract to hold global state that is needed by a number of other contracts,
together with functions for mutating it.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Structures.sol';
import './Utils.sol';
import './Config.sol';

contract State is Structures, Config {
  // global state variables
  BlockData[] public blockHashes; // array containing mainly blockHashes
  mapping(address => uint) public pendingWithdrawals;
  mapping(address => LinkedAddress) public proposers;
  mapping(address => TimeLockedStake) public stakeAccounts;
  mapping(bytes32 => bool) public claimedBlockStakes;
  LinkedAddress public currentProposer; // who can propose a new shield state
  uint256 public proposerStartBlock; // L1 block where currentProposer became current
  // local state variables
  address public proposersAddress;
  address public challengesAddress;
  address public shieldAddress;

  uint256 public numProposers; // number of proposers  
  address[] public slots; // slots based on proposers stake
  ProposerSet[] public proposersSet; // proposer set for next span
  uint256 public currentSprint; // the current sprint of the span

  constructor(address _proposersAddress, address _challengesAddress, address _shieldAddress) {
    proposersAddress = _proposersAddress;
    challengesAddress = _challengesAddress;
    shieldAddress = _shieldAddress;
  }

  modifier onlyRegistered {
    require(msg.sender == proposersAddress || msg.sender == challengesAddress || 
      msg.sender == shieldAddress, 
      'State: Not authorised to call this function');
    _;
  }


  modifier onlyCurrentProposer { // Modifier
    require(msg.sender == currentProposer.thisAddress, "State: Only current proposer authorised.");
      _;
  }

  receive() external payable{
    //fallback for payable
  }

  /**
  * Allows a Proposer to propose a new block of state updates.
  * @param b the block being proposed.  This function is kept in State.sol
  * so that we don't have cross-contract calls and thus keep Gas to an absolute
  * minimum.
  */
  function proposeBlock(Block calldata b, Transaction[] calldata t) external payable onlyCurrentProposer {
    require(b.blockNumberL2 == blockHashes.length, 'State: Block out of order'); // this will fail if a tx is re-mined out of order due to a chain reorg.
    bytes32 previousBlockHash;
    if (blockHashes.length != 0) require(b.previousBlockHash == blockHashes[blockHashes.length - 1].blockHash, 
      'State: Block flawed or out of order'); // this will fail if a tx is re-mined out of order due to a chain reorg.

    TimeLockedStake memory stake = getStakeAccount(msg.sender);
    require(BLOCK_STAKE <= stake.amount, 'State: Need BLOCK_STAKE');
    require(b.proposer == msg.sender, 'State: Proposer is not the sender');
    stake.amount -= BLOCK_STAKE;
    stake.challengeLocked += BLOCK_STAKE;
    stakeAccounts[msg.sender] = TimeLockedStake(stake.amount, stake.challengeLocked, 0);

    // We need to set the blockHash on chain here, because there is no way to
    // convince a challenge function of the (in)correctness by an offchain
    // computation; the on-chain code doesn't save the pre-image of the hash so
    // it can't tell if it's been given the correct one as part of a challenge.
    // To do this, we simply hash the function parameters because (1) they
    // contain all of the relevant data (2) it doesn't take much gas.
    // All check pass so add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data plus the absolute minimum of metadata - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.
    blockHashes.push(BlockData({
      blockHash: keccak256(msg.data[4:]),
      time: block.timestamp
    }));
    // Timber will listen for the BlockProposed event as well as
    // nightfall-optimist.  The current, optimistic version of Timber does not
    // require the smart contract to craft NewLeaf/NewLeaves events.
    emit BlockProposed();
  }

  // function to signal a rollback. Note that we include the block hash because
  // it's uinque, although technically not needed (Optimist consumes the
  // block number and Timber the leaf count). It's helpful when testing to make
  // sure we have the correct event.
  function emitRollback(
    uint256 blockNumberL2ToRollbackTo,
    uint256 leafCountToRollbackTo
  ) public onlyRegistered {
    emit Rollback(blockHashes[blockNumberL2ToRollbackTo].blockHash, blockNumberL2ToRollbackTo, leafCountToRollbackTo);
  }

  function setProposer(address addr, LinkedAddress memory proposer) public onlyRegistered {
    proposers[addr] = proposer;
  }

  function getProposer(address addr) public view returns(LinkedAddress memory) {
    return proposers[addr];
  }

  function deleteProposer(address addr) public onlyRegistered {
    delete proposers[addr];
  }

  function setCurrentProposer(address proposer) public onlyRegistered {
    currentProposer = proposers[proposer];
  }

  function getCurrentProposer() public view returns(LinkedAddress memory) {
    return currentProposer;
  }

  function pushBlockData(BlockData memory bd) public onlyRegistered {
    blockHashes.push(bd);
  }

  function popBlockData() public onlyRegistered returns(BlockData memory) {
    // oddly .pop() doesn't return the 'popped' element
    BlockData memory popped = blockHashes[blockHashes.length - 1];
    blockHashes.pop();
    return popped;
  }

  function getBlockData(uint256 blockNumberL2) public view returns(BlockData memory) {
    return blockHashes[blockNumberL2];
  }

  /*
  return all of the block data as an array.  This lets us do off-chain
  reverse lookups
  */
  function getAllBlockData() public view returns(BlockData[] memory) {
    return blockHashes;
  }

  function getNumberOfL2Blocks() public view returns(uint) {
    return blockHashes.length;
  }

  function getLatestBlockHash() public view returns(bytes32) {
    if (blockHashes.length != 0) return blockHashes[blockHashes.length - 1].blockHash;
    else return Config.ZERO;
  }

  function addPendingWithdrawal(address addr, uint256 amount) public onlyRegistered {
    pendingWithdrawals[addr] += amount;
  }

  function withdraw() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
  }

  function setProposerStartBlock(uint256 sb) public onlyRegistered {
    proposerStartBlock = sb;
  }

  function getProposerStartBlock() public view returns(uint256) {
    return proposerStartBlock;
  }

  function setNumProposers(uint256 np) public onlyRegistered {
    numProposers = np;
  }
  
  function getNumProposers() public view returns(uint256) {
    return numProposers;
  }

  function removeProposer(address proposer) public onlyRegistered {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    numProposers--;
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;

    if (proposer == currentProposer.thisAddress) {
      proposerStartBlock = proposerStartBlock + ROTATE_PROPOSER_BLOCKS + 1; // force to rotate currentProposer
      changeCurrentProposer();
    }
  }
  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b, Transaction[] memory t, uint256 blockNumberL2) public view {
    bytes32 blockHash = Utils.hashBlock(b, t);
    require(blockHashes[blockNumberL2].blockHash == blockHash, 'State: Block does not exist');
  }

  /**
   * @dev Set stake account for the address addr with amount of stake and challengeLocked
   */
  function setStakeAccount(address addr, uint256 amount, uint256 challengeLocked) public onlyRegistered {
    stakeAccounts[addr] = TimeLockedStake(amount, challengeLocked, 0);
  }

  /**
   * @dev Get stake account for the address addr
   */
  function getStakeAccount(address addr) public view returns (TimeLockedStake memory){
    return stakeAccounts[addr];
  }

  function rewardChallenger(address challengerAddr, address proposer, uint256 numRemoved) public onlyRegistered {
    removeProposer(proposer);
    TimeLockedStake memory stake = stakeAccounts[proposer];
    // Give reward to challenger from the stake locked for challenges
    stakeAccounts[proposer] = TimeLockedStake(stake.amount, stake.challengeLocked - numRemoved * BLOCK_STAKE, 0);
    pendingWithdrawals[challengerAddr] += numRemoved * BLOCK_STAKE;
  }

  function updateStakeAccountTime(address addr, uint256 time) public onlyRegistered {
    TimeLockedStake memory stake = stakeAccounts[addr];
    stake.time = time;
    stakeAccounts[addr] = stake;
  }

  function isBlockStakeWithdrawn(bytes32 blockHash) public view returns (bool){
    return claimedBlockStakes[blockHash];
  }

  function setBlockStakeWithdrawn(bytes32 blockHash) public onlyRegistered {
    claimedBlockStakes[blockHash] = true;
  }

  /**
   * Each proposer gets a chance to propose blocks for a certain time, defined
   * in Ethereum blocks.  After a certain number of blocks has passed, the
   * proposer can be rotated by calling this function. The method for choosing
   * the next proposer is simple rotation for now.
   */
  function changeCurrentProposer() public {
    require(block.number - proposerStartBlock > ROTATE_PROPOSER_BLOCKS,
    "Proposers: Too soon to rotate proposer");
  
    address addressBestPeer;
    
    if( numProposers <= 1 ){
        currentSprint = 0; // We don't have sprints because always same proposer
        addressBestPeer = currentProposer.thisAddress;
    } else {
      ProposerSet memory peer;
      uint256 totalEffectiveWeight = 0;

      if (currentSprint == SPRINTS_IN_SPAN) currentSprint = 0;
      if (currentSprint == 0) initializeSpan();

      for (uint256 i = 0; i < proposersSet.length; i++) {
        peer = proposersSet[i];
        totalEffectiveWeight += peer.effectiveWeight;
        peer.currentWeight += int256(peer.effectiveWeight);

        if (peer.effectiveWeight < peer.weight)
            peer.effectiveWeight++;
        if (addressBestPeer == address(0) || proposersSet[proposers[addressBestPeer].indexProposerSet].currentWeight < peer.currentWeight) {
            addressBestPeer = peer.thisAddress;
        }      
      }

      if (proposersSet[proposers[addressBestPeer].indexProposerSet].weight!=0)
          proposersSet[proposers[addressBestPeer].indexProposerSet].currentWeight -= int256(totalEffectiveWeight);        

      currentSprint += 1;
    }

    currentProposer = proposers[addressBestPeer];
    proposerStartBlock = block.number;
    emit NewCurrentProposer(currentProposer.thisAddress);    
  }

  /**
   * @dev Initialize a new span
   */
  function initializeSpan() internal {
      fillSlots();        // 1) initialize slots based on the stake and VALUE_PER_SLOT
      shuffleSlots();     // 2) shuffle the slots
      spanProposerSet();  // 3) pop the proposer set from shuffled slots
  }

  /**
   * @dev Fill slots based on the weight
   */
  function fillSlots() public {
    require(currentProposer.thisAddress != address(0), "State: Current proposer not initialized");
    LinkedAddress memory p = currentProposer;
    TimeLockedStake memory stake = getStakeAccount(p.thisAddress);
 
    uint256 weight;
    
    // 1) remove all slots
    delete slots;
    // 2) assign slots based on the stake of the proposers
    if (numProposers == 1) {
        weight = stake.amount / VALUE_PER_SLOT;
        for (uint256 i = 0; i < weight; i++) {
            slots.push(p.thisAddress);
        }
    }
    else {
        while (p.nextAddress != currentProposer.thisAddress) {
            weight = stake.amount / VALUE_PER_SLOT;
            for (uint256 i = 0; i < weight; i++) {
                slots.push(p.thisAddress);
            }
            p = proposers[p.nextAddress];
        }
        weight = stake.amount / VALUE_PER_SLOT;
        for (uint256 i = 0; i < weight; i++) {
            slots.push(p.thisAddress);
        }
    }
  }

  /**
   * @dev Shuffle the slots of all proposers
   */
  function shuffleSlots() internal {
    for (uint256 i = 0; i < slots.length; i++) {
        uint256 n = i + uint256(keccak256(abi.encodePacked(block.timestamp))) % (slots.length - i);
        address temp = slots[n];
        slots[n] = slots[i];
        slots[i] = temp;
    }
  }  

  /**
   * @dev Pop the proposer set for next Span
   */
  function spanProposerSet() internal {
    for (uint256 i = 0; i < proposersSet.length; i++) {
        proposers[proposersSet[i].thisAddress].inProposerSet = false;
        proposers[proposersSet[i].thisAddress].indexProposerSet = 0;            
    }
    
    delete proposersSet;

    // add proposersSet
    for(uint256 i = 0; i < PROPOSER_SET_COUNT; i++) {
        LinkedAddress memory p = proposers[slots[i]];
        if (p.inProposerSet == false) {                
            p.inProposerSet = true;
            p.indexProposerSet = proposersSet.length;               
            ProposerSet memory ps = ProposerSet(p.thisAddress, 1, 0, 0);
            proposersSet.push(ps);
            proposers[slots[i]] = p;
        } else {
            proposersSet[p.indexProposerSet].weight += 1;
        }
    }

    // initialize weights for WRR
    for(uint256 i = 0; i < proposersSet.length; i++) {
        proposersSet[i].currentWeight = int256(proposersSet[i].weight);
        proposersSet[i].effectiveWeight = proposersSet[i].weight;
    }     
  }  
}
