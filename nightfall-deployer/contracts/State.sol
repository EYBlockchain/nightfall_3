// SPDX-License-Identifier: CC0-1.0
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';

/**
Contract to hold global state that is needed by a number of other contracts,
together with functions for mutating it.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Utils.sol';
import './Config.sol';
import './Pausable.sol';
import './Key_Registry.sol';

contract State is ReentrancyGuardUpgradeable, Pausable, Key_Registry, Config {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // global state variables
    mapping(bytes32 => TransactionInfo) public txInfo;
    BlockData[] public blockHashes; // array containing mainly blockHashes
    mapping(address => FeeTokens) public pendingWithdrawalsFees;
    mapping(address => LinkedAddress) public proposers;
    mapping(address => TimeLockedStake) public stakeAccounts;
    mapping(bytes32 => BlockInfo) public blockInfo;
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
    address[] public proposersList;

    function initialize() public override(Pausable, Key_Registry, Config) {
        Pausable.initialize();
        Key_Registry.initialize();
        Config.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    function initializeState(
        address _proposersAddress,
        address _challengesAddress,
        address _shieldAddress
    ) public initializer {
        proposersAddress = _proposersAddress;
        challengesAddress = _challengesAddress;
        shieldAddress = _shieldAddress;
        initialize();
    }

    modifier onlyShield() {
        require(msg.sender == shieldAddress, 'State: Only shield contract is authorized');
        _;
    }

    modifier onlyProposer() {
        require(msg.sender == proposersAddress, 'State: Only proposer contract is authorized');
        _;
    }

    modifier onlyChallenger() {
        require(msg.sender == challengesAddress, 'State: Only challenger contract is authorized');
        _;
    }

    modifier onlyCurrentProposer() {
        // Modifier
        require(
            msg.sender == currentProposer.thisAddress,
            'State: Only current proposer authorised'
        );
        _;
    }

    receive() external payable {
        //fallback for payable
    }

    /**
     * Allows a Proposer to propose a new block of state updates.
     * @param b the block being proposed.  This function is kept in State.sol
     * so that we don't have cross-contract calls and thus keep Gas to an absolute
     * minimum.
     */
    function proposeBlock(Block calldata b, Transaction[] calldata t)
        external
        payable
        onlyCurrentProposer
        whenNotPaused
    {
        require(Utils.getBlockNumberL2(b.packedInfo) == blockHashes.length, 'State: Block out of order'); // this will fail if a tx is re-mined out of order due to a chain reorg.
        if (blockHashes.length != 0) {
            require(
                b.previousBlockHash == blockHashes[blockHashes.length - 1].blockHash,
                'State: Block flawed or out of order'
            ); // this will fail if a tx is re-mined out of order due to a chain reorg.
        }
        require(Utils.getProposer(b.packedInfo) == msg.sender, 'State: The sender is not the proposer');
        require(
            stakeAccounts[msg.sender].amount + msg.value >= blockStake,
            'State: Proposer does not have enough funds staked'
        );
        stakeAccounts[msg.sender].amount = stakeAccounts[msg.sender].amount + uint112(msg.value) - blockStake;
        stakeAccounts[msg.sender].challengeLocked += blockStake;
        stakeAccounts[msg.sender].time = 0;

        uint120 feesMatic = 0;
        uint120 feesEth = 0;

        bytes32 blockHash;
        uint256 blockSlots = BLOCK_STRUCTURE_SLOTS; //Number of slots that the block structure has
        uint256 maxBlockSize = MAX_BLOCK_SIZE;


        assembly {
            //Function that calculates the height of the Merkle Tree
            function getTreeHeight(leaves) -> _height {
                _height := 1
                for {

                } lt(exp(2, _height), leaves) {

                } {
                    _height := add(_height, 1)
                }
            }
		
            if lt(maxBlockSize, sub(calldatasize(), add(t.offset, calldataload(t.offset)))) {
                mstore(0, 0x41c918e600000000000000000000000000000000000000000000000000000000) //Custom error InvalidBlockSize
                revert(0, 4)
            }

            let x := mload(0x40) //Gets the first free memory pointer
            let transactionHashesPos := add(x, mul(0x20, 3)) // calculate memory location of the transaction hashes
            let transactionPos := add(
                transactionHashesPos,
                mul(0x20, exp(2, getTreeHeight(t.length)))
            )

            for {
                let i := 0
            } lt(i, t.length) {
                i := add(i, 1)
            } {
                let transactionSlots := div(
                    sub(
                        add(t.offset, calldataload(add(t.offset, mul(0x20, add(i, 1))))),
                        add(t.offset, calldataload(add(t.offset, mul(0x20, i))))
                    ),
                    32
                )

                if eq(add(i, 1), t.length) {
                    transactionSlots := div(
                        sub(
                            calldatasize(),
                            add(t.offset, calldataload(add(t.offset, mul(0x20, i))))
                        ),
                        32
                    )
                }

                // Copy the transaction into transactionPos
                calldatacopy(
                    add(transactionPos, 0x20),
                    add(t.offset, calldataload(add(t.offset, mul(0x20, i)))),
                    mul(0x20, transactionSlots)
                )

                // Calculate the hash of the transaction and store it in transactionHashesPos
                mstore(transactionPos, 0x20)

                mstore(
                    add(transactionHashesPos, mul(0x20, i)),
                    keccak256(transactionPos, mul(0x20, add(transactionSlots, 1)))
                )

                // We need to check if circuit requires to escrow funds
                mstore(x, shr(216,calldataload(add(t.offset, calldataload(add(t.offset, mul(0x20, i)))))))
                mstore(add(x, 0x20), circuitInfo.slot)
                
                let isEscrowRequired := shr(8, sload(keccak256(x, mul(0x20, 2))))
                let fee := shr(160,shl(40,calldataload(add(t.offset, calldataload(add(t.offset, mul(0x20, i)))))))

                switch isEscrowRequired
                case true {
                    mstore(x, mload(add(transactionHashesPos, mul(0x20, i))))
                    mstore(add(x, 0x20), txInfo.slot)
                    let transactionInfo := sload(keccak256(x, mul(0x20, 2)))
                    
                    //If the funds weren't deposited, means the user sent the deposit off-chain, which is not allowed. Revert
                    if iszero(shr(248,transactionInfo)) {
                        mstore(
                            0,
                            0xd96541f500000000000000000000000000000000000000000000000000000000 //Custom error DepositNotEscrowed
                        )
                        mstore(0x04, mload(add(transactionHashesPos, mul(0x20, i))))
                        revert(0, 36)
                    }
            
                    // If the transaction fee is zero, check if there was any fee paid in eth and update the ETH fee payments
                    if iszero(fee) {
                        feesEth := add(feesEth, shr(8,shl(8,transactionInfo)))
                    }
                }
                case false {
                    // If the transaction fee is zero, check if there was any fee paid in eth and update the ETH fee payments
                    if iszero(fee) {
                        mstore(x, mload(add(transactionHashesPos, mul(0x20, i))))
                        mstore(add(x, 0x20), txInfo.slot)
                        feesEth := add(feesEth, shr(8,shl(8,sload(keccak256(x, mul(0x20, 2))))))
                    }
                }

                // If the transaction fee is not zero, update the MATIC fee payments
                if eq(iszero(fee),0) {
                    feesMatic := add(feesMatic, fee)
                }
            }

            //Calculate the root of the transactions merkle tree
            for {
                let i := getTreeHeight(t.length)
            } gt(i, 0) {
                i := sub(i, 1)
            } {
                for {
                    let j := 0
                } lt(j, exp(2, sub(i, 1))) {
                    j := add(j, 1)
                } {
                    let leftPos := add(transactionHashesPos, mul(mul(0x20, j), 2))
                    if eq(and(iszero(mload(leftPos)), iszero(mload(add(leftPos, 0x20)))), 1) {
                        mstore(add(transactionHashesPos, mul(0x20, j)), 0)
                    }
                    if eq(and(iszero(mload(leftPos)), iszero(mload(add(leftPos, 0x20)))), 0) {
                        mstore(add(transactionHashesPos, mul(0x20, j)), keccak256(leftPos, 0x40))
                    }
                }
            }
            // check if the transaction hashes root calculated equal to the one passed as part of block data
            if eq(
                eq(
                    calldataload(add(0x04, mul(sub(blockSlots, 1), 0x20))),
                    mload(transactionHashesPos)
                ),
                0
            ) {
                mstore(0, 0x3c80abfc00000000000000000000000000000000000000000000000000000000) //Custom error InvalidTransactionHash
                revert(0, 4)
            }
            // calculate block hash
            calldatacopy(x, 0x04, mul(0x20, blockSlots)) //Copy the block structure into x
            blockHash := keccak256(x, mul(blockSlots, 0x20))
        }
        // We need to set the blockHash on chain here, because there is no way to
        // convince a challenge function of the (in)correctness by an offchain
        // computation; the on-chain code doesn't save the pre-image of the hash so
        // it can't tell if it's been given the correct one as part of a challenge.
        // To do this, we simply hash the function parameters because (1) they
        // contain all of the relevant data (2) it doesn't take much gas.
        // All check pass so add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data plus the absolute minimum of metadata - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.

        // Store block fees
        blockInfo[blockHash].feesMatic = feesMatic;
        blockInfo[blockHash].feesEth = feesEth;
        
        // blockHash is hash of all block data and hash of all the transactions data.
        blockHashes.push(
            BlockData({
                blockHash: blockHash,
                time: block.timestamp,
                blockStake: blockStake,
                proposer: Utils.getProposer(b.packedInfo)
            })
        );
        // Timber will listen for the BlockProposed event as well as
        // nightfall-optimist.  The current, optimistic version of Timber does not
        // require the smart contract to craft NewLeaf/NewLeaves events.
        emit BlockProposed();
    }

    function setTransactionInfo(bytes32 transactionHash, bool isEscrowed, uint248 ethFee) public onlyShield {
        txInfo[transactionHash].isEscrowed = isEscrowed;
        txInfo[transactionHash].ethFee = ethFee;
    }

    function setProposer(address addr, LinkedAddress calldata proposer) public onlyProposer {
        proposers[addr] = proposer;
    }

    function getProposer(address addr) public view returns (LinkedAddress memory) {
        return proposers[addr];
    }

    function setCurrentProposer(address proposer) public onlyProposer {
        currentProposer = proposers[proposer];
    }

    function getCurrentProposer() public view returns (LinkedAddress memory) {
        return currentProposer;
    }

    function resetFeeBookBlocksInfo(bytes32 blockHash) public onlyShield {
        blockInfo[blockHash].feesEth = 0;
        blockInfo[blockHash].feesMatic = 0;
    }

    function popBlockData() public onlyChallenger returns (BlockData memory) {
        // oddly .pop() doesn't return the 'popped' element
        BlockData memory popped = blockHashes[blockHashes.length - 1];
        blockHashes.pop();
        return popped;
    }

    function getBlockData(uint64 blockNumberL2) public view returns (BlockData memory) {
        require(blockNumberL2 < blockHashes.length, 'State: Invalid block number L2');
        return blockHashes[blockNumberL2];
    }

    function getNumberOfL2Blocks() public view returns (uint256) {
        return blockHashes.length;
    }

    function addPendingWithdrawal(
        address addr,
        uint256 feesEth,
        uint256 feesMatic
    ) public {
        require(msg.sender == proposersAddress ||
                msg.sender == shieldAddress,
            'State: Not authorised to call this function');

        pendingWithdrawalsFees[addr] = FeeTokens(uint120(feesEth), uint120(feesMatic)); 
    }

    function withdraw() external nonReentrant whenNotPaused {
        uint256 amountEth = pendingWithdrawalsFees[msg.sender].feesEth;
        uint256 amountMatic = pendingWithdrawalsFees[msg.sender].feesMatic;

        if (amountEth > 0) {
            pendingWithdrawalsFees[msg.sender].feesEth = 0;
            (bool success, ) = payable(msg.sender).call{value: amountEth}('');
            require(success, 'Transfer failed.');
        }
        if (amountMatic > 0) {
            pendingWithdrawalsFees[msg.sender].feesMatic = 0;
            IERC20Upgradeable(super.getMaticAddress()).safeTransferFrom(
                address(this),
                msg.sender,
                amountMatic
            );
        }
    }

    function setProposerStartBlock(uint256 sb) public onlyProposer {
        proposerStartBlock = sb;
    }

    function setNumProposers(uint256 np) public onlyProposer {
        numProposers = np;
        if (numProposers == 2) {
            initializeSpan();
            calculateNextProposers(address(0));
        }
    }

    function getNumProposers() public view returns (uint256) {
        return numProposers;
    }

    function removeProposer(address proposer) public {
         require(msg.sender == proposersAddress ||
                msg.sender == challengesAddress,
            'State: Not authorised to call this function');
        _removeProposer(proposer);
        if (proposer == currentProposer.thisAddress || currentProposer.thisAddress == address(0)) {
            currentProposer = proposers[currentProposer.nextAddress]; // we need to refresh the current proposer before the change
            proposerStartBlock = 0;
            changeCurrentProposer();
        }
    }

    function _removeProposer(address proposer) internal {
        address previousAddress = proposers[proposer].previousAddress;
        address nextAddress = proposers[proposer].nextAddress;
        delete proposers[proposer];
        numProposers--;
        proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
        proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
        if (
            previousAddress == currentProposer.thisAddress ||
            nextAddress == currentProposer.thisAddress
        ) {
            currentProposer = proposers[currentProposer.thisAddress]; // we need to refresh the current proposer addresses
        }
    }

    function updateProposer(
        address proposer,
        string calldata url,
        uint256 fee
    ) public onlyProposer {
        proposers[proposer].url = url;
        proposers[proposer].fee = fee;
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block).
    function isBlockReal(Block calldata b) public view {
        uint64 blockNumberL2 = Utils.getBlockNumberL2(b.packedInfo);
        require(
            blockNumberL2 < blockHashes.length &&
                blockHashes[blockNumberL2].blockHash == Utils.hashBlock(b),
            'State: Block does not exist'
        );
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block).
    function areBlockAndTransactionsReal(Block calldata b, Transaction[] calldata ts) public view {
        isBlockReal(b);
        require(
            b.transactionHashesRoot == Utils.hashTransactionHashes(ts),
            'State: Transaction hashes root does not match'
        );
    }

   

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block). It also checks if a transaction is contained in a block using its sibling path
    function areBlockAndTransactionReal(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) public view returns (bytes32) {
        isBlockReal(b);
        require(
            b.transactionHashesRoot == siblingPath[0],
            'State: Transaction hashes root is incorrect'
        );
        bytes32 transactionHash = Utils.hashTransaction(t);
        require(Utils.checkPath(siblingPath, index, transactionHash), 'State: Transaction does not exist in block');
        return transactionHash;
    }

    /**
     * @dev Set stake account for the address addr with amount of stake and challengeLocked
     */
    function setStakeAccount(
        address addr,
        uint256 amount,
        uint256 challengeLocked
    ) public {
         require(msg.sender == proposersAddress ||
                msg.sender == shieldAddress,
            'State: Not authorised to call this function');
        stakeAccounts[addr] = TimeLockedStake(uint112(amount), uint112(challengeLocked), 0);
    }

    /**
     * @dev Get stake account for the address addr
     */
    function getStakeAccount(address addr) public view returns (TimeLockedStake memory) {
        return stakeAccounts[addr];
    }

    function rewardChallenger(
        address challengerAddr,
        address proposer,
        BlockData[] memory badBlocks
    ) public onlyChallenger {
        removeProposer(proposer);

        uint120 rewardedStake = 0;
        for (uint256 i = 0; i < badBlocks.length; ++i) {
            TimeLockedStake memory stake = stakeAccounts[badBlocks[i].proposer];
            // Give reward to challenger from the stake locked for challenges
            stakeAccounts[proposer] = TimeLockedStake(
                stake.amount,
                stake.challengeLocked - badBlocks[i].blockStake,
                0
            );
            rewardedStake += badBlocks[i].blockStake;
        }

        pendingWithdrawalsFees[challengerAddr].feesEth += rewardedStake;
    }

    function updateStakeAccountTime(address addr, uint256 time) public onlyProposer {
        stakeAccounts[addr].time = uint32(time);
    }

    function setBlockStakeWithdrawn(bytes32 blockHash) public {
         require(msg.sender == challengesAddress ||
                msg.sender == shieldAddress,
            'State: Not authorised to call this function');
        blockInfo[blockHash].stakeClaimed = true;
    }

    /**
     * Each proposer gets a chance to propose blocks for a certain time, defined
     * in Ethereum blocks.  After a certain number of blocks has passed, the
     * proposer can be rotated by calling this function. The method for choosing
     * the next proposer is simple rotation for now.
     */
    function changeCurrentProposer() public {
        require(
            block.number - proposerStartBlock > rotateProposerBlocks ||
                proposerStartBlock == 0 ||
                maxProposers == 1,
            'State: Too soon to rotate proposer'
        );

        // if maxProposers=1 only bootProposer as proposer
        if (maxProposers == 1 && numProposers > 1) {
            currentProposer = proposers[bootProposer]; // the current proposer will be the boot proposer
            address selectedProposer = currentProposer.nextAddress;
            while (numProposers > 1) {
                _removeProposer(selectedProposer);
                // The selectedProposer has to wait a CHALLENGE_PERIOD from current block.timestamp
                stakeAccounts[selectedProposer].time = uint32(block.timestamp);
                selectedProposer = currentProposer.nextAddress;
            }
        }

        address addressBestPeer;

        if (numProposers <= 1) {
            currentSprint = 0; // We don't have sprints because always same proposer
            addressBestPeer = currentProposer.thisAddress;
        } else {
            addressBestPeer = proposersList[currentSprint];
            currentSprint += 1;

            if (currentSprint == sprintsInSpan) {
                currentSprint = 0;
            }

            if (currentSprint == 0) {
                initializeSpan();
                calculateNextProposers(addressBestPeer);
            }
        }

        currentProposer = proposers[addressBestPeer];
        proposerStartBlock = block.number;
        emit NewCurrentProposer(currentProposer.thisAddress);
    }

    function getProposersList() public view returns (address[] memory) {
        return proposersList;
    }

    function calculateNextProposers(address addressBestPeer) internal {
        ProposerSet memory peer;
        uint256 totalEffectiveWeight = 0;
        for (uint256 j = 0; j < proposerSetCount; j++) {
            for (uint256 i = 0; i < proposersSet.length; i++) {
                peer = proposersSet[i];
                totalEffectiveWeight += peer.effectiveWeight;
                peer.currentWeight += int256(peer.effectiveWeight);

                if (peer.effectiveWeight < peer.weight) peer.effectiveWeight++;
                if (
                    addressBestPeer == address(0) ||
                    proposersSet[proposers[addressBestPeer].indexProposerSet].currentWeight <
                    peer.currentWeight
                ) {
                    addressBestPeer = peer.thisAddress;
                }
            }

            if (proposersSet[proposers[addressBestPeer].indexProposerSet].weight != 0)
                proposersSet[proposers[addressBestPeer].indexProposerSet].currentWeight -= int256(
                    totalEffectiveWeight
                );

            proposersList.push(addressBestPeer);
        }
    }

    /**
     * @dev Initialize a new span
     */
    function initializeSpan() internal {
        fillSlots(); // 1) initialize slots based on the stake
        shuffleSlots(); // 2) shuffle the slots
        spanProposerSet(); // 3) pop the proposer set from shuffled slots
    }

    /**
     * @dev Fill slots based on the weight
     */
    function fillSlots() public {
        require(
            currentProposer.thisAddress != address(0),
            'State: Current proposer not initialized'
        );
        LinkedAddress memory p = currentProposer;
        TimeLockedStake memory stake;
        uint256 weight;

        uint256 slotValue; // we calculate the slotValue depending on the proposer stakes
        uint256 maximumSlots = 10; // maximum slots we want for the biggest proposer stake
        while (p.nextAddress != currentProposer.thisAddress) {
            stake = getStakeAccount(p.thisAddress);
            if (slotValue < stake.amount / maximumSlots) {
                slotValue = stake.amount / maximumSlots;
            }
            p = proposers[p.nextAddress];
        }
        stake = getStakeAccount(p.thisAddress);
        if (slotValue < stake.amount / maximumSlots) {
            slotValue = stake.amount / maximumSlots;
        }

        p = currentProposer;

        // 1) remove all slots
        delete slots;
        // 2) assign slots based on the stake of the proposers
        while (p.nextAddress != currentProposer.thisAddress) {
            stake = getStakeAccount(p.thisAddress);
            weight = stake.amount / slotValue;
            if (weight == 0) weight = 1;
            for (uint256 i = 0; i < weight; i++) {
                slots.push(p.thisAddress);
            }
            p = proposers[p.nextAddress];
        }
        stake = getStakeAccount(p.thisAddress);
        weight = stake.amount / slotValue;
        if (weight == 0) weight = 1;
        for (uint256 i = 0; i < weight; i++) {
            slots.push(p.thisAddress);
        }
    }

    /**
     * @dev Shuffle the slots of all proposers
     */
    function shuffleSlots() internal {
        for (uint256 i = 0; i < slots.length; i++) {
            uint256 n = i +
                (uint256(keccak256(abi.encodePacked(block.timestamp))) % (slots.length - i));
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
        for (uint256 i = 0; i < proposerSetCount; i++) {
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
        for (uint256 i = 0; i < proposersSet.length; i++) {
            proposersSet[i].currentWeight = int256(proposersSet[i].weight);
            proposersSet[i].effectiveWeight = proposersSet[i].weight;
        }
    }
}
