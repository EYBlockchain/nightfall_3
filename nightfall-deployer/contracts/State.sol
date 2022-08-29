// SPDX-License-Identifier: CC0-1.0
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
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

contract State is Initializable, ReentrancyGuardUpgradeable, Pausable, Config {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // global state variables
    BlockData[] public blockHashes; // array containing mainly blockHashes
    mapping(address => uint256[2]) public pendingWithdrawals;
    mapping(address => LinkedAddress) public proposers;
    mapping(address => TimeLockedStake) public stakeAccounts;
    mapping(bytes32 => uint256[2]) public feeBook;
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

    function initialize() public override(Pausable, Config) {
        Pausable.initialize();
        Config.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    function initialize(
        address _proposersAddress,
        address _challengesAddress,
        address _shieldAddress
    ) public initializer {
        proposersAddress = _proposersAddress;
        challengesAddress = _challengesAddress;
        shieldAddress = _shieldAddress;
        initialize();
    }

    modifier onlyRegistered() {
        require(
            msg.sender == proposersAddress ||
                msg.sender == challengesAddress ||
                msg.sender == shieldAddress,
            'State: Not authorised to call this function'
        );
        _;
    }

    modifier onlyShield() {
        require(msg.sender == shieldAddress, 'Only shield contract is authorized');
        _;
    }

    modifier onlyProposer() {
        require(msg.sender == proposersAddress, 'Only proposer contract is authorized');
        _;
    }

    modifier onlyChallenger() {
        require(msg.sender == challengesAddress, 'Only challenger contract is authorized');
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
        require(b.blockNumberL2 == blockHashes.length, 'State: Block out of order'); // this will fail if a tx is re-mined out of order due to a chain reorg.
        if (blockHashes.length != 0)
            require(
                b.previousBlockHash == blockHashes[blockHashes.length - 1].blockHash,
                'State: Block flawed or out of order'
            ); // this will fail if a tx is re-mined out of order due to a chain reorg.

        TimeLockedStake memory stake = getStakeAccount(msg.sender);
        require(BLOCK_STAKE <= msg.value, 'State: Stake payment is incorrect');
        require(b.proposer == msg.sender, 'State: Proposer address is not the sender');
        // set the maximum tx/block to prevent unchallengably large blocks
        require(t.length <= TRANSACTIONS_PER_BLOCK, 'State: The block has too many transactions');
        stake.amount -= BLOCK_STAKE;
        stake.challengeLocked += BLOCK_STAKE;
        stakeAccounts[msg.sender] = TimeLockedStake(stake.amount, stake.challengeLocked, 0);

        uint256 feePaymentsEth = 0;
        uint256 feePaymentsMatic = 0;
        for (uint256 i = 0; i < t.length; i++) {
            if (t[i].transactionType == TransactionTypes.DEPOSIT) {
                feePaymentsEth += uint256(t[i].fee);
            } else {
                feePaymentsMatic += uint256(t[i].fee);
            }
        }

        bytes32 input = keccak256(abi.encodePacked(b.proposer, b.blockNumberL2));
        feeBook[input][0] = feePaymentsEth;
        feeBook[input][1] = feePaymentsMatic;

        bytes32 blockHash;

        uint256 blockSlots = BLOCK_STRUCTURE_SLOTS; //Number of slots that the block structure has
        uint256 transactionSlots = TRANSACTION_STRUCTURE_SLOTS; //Number of slots that the transaction structure has

        //Get the signature for the function that checks if the transaction has been escrowed or not
        bytes4 checkTxEscrowedSignature = bytes4(keccak256('getTransactionEscrowed(bytes32)')); //Function signature

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

            let x := mload(0x40) //Gets the first free memory pointer
            let blockPos := add(x, mul(0x20, 2)) //Save two slots of 32 bytes for calling external libraries
            calldatacopy(blockPos, 0x04, mul(0x20, blockSlots)) //Copy the block structure into blockPos
            let transactionHashesPos := add(blockPos, mul(0x20, blockSlots)) // calculate memory location of the transaction hashes
            let transactionPos := add(
                // calculate memory location of transactions
                transactionHashesPos,
                mul(0x20, exp(2, getTreeHeight(t.length)))
            )

            for {
                let i := 0
            } lt(i, t.length) {
                i := add(i, 1)
            } {
                // Copy the transaction into transactionPos
                calldatacopy(
                    transactionPos,
                    add(t.offset, mul(mul(0x20, transactionSlots), i)),
                    mul(0x20, transactionSlots)
                )

                // Calculate the hash of the transaction and store it in transactionHashesPos
                mstore(
                    add(transactionHashesPos, mul(0x20, i)),
                    keccak256(transactionPos, mul(0x20, transactionSlots))
                )

                // Get the transaction type
                let transactionType := calldataload(
                    add(t.offset, add(mul(mul(0x20, transactionSlots), i), mul(0x20, 2)))
                )

                // If the transactionType is zero (aka deposit), we need to check if the funds were escrowed
                if iszero(transactionType) {
                    mstore(x, checkTxEscrowedSignature) //Store the signature of the function in x
                    mstore(add(x, 0x04), mload(add(transactionHashesPos, mul(0x20, i)))) //Store the transactionHash after the signature
                    pop(
                        call(
                            // Call getTransactionEscrowed function to see if funds has been deposited
                            gas(),
                            shieldAddress.slot, //To addr
                            0, //No value
                            x, //Inputs are stored at location x
                            0x24, //Inputs are 36 bytes long
                            x, //Store output over input (saves space)
                            0x20 //Outputs are 32 bytes long
                        )
                    )
                    //If the funds weren't deposited, means the user sent the deposit off-chain, which is not allowed. Revert
                    if iszero(mload(x)) {
                        revert(0, 0)
                    }
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
                    let left := mload(add(transactionHashesPos, mul(mul(0x20, j), 2)))
                    let right := mload(add(transactionHashesPos, add(mul(mul(0x20, j), 2), 0x20)))
                    if eq(and(iszero(left), iszero(right)), 1) {
                        mstore(add(transactionHashesPos, mul(0x20, j)), 0)
                    }
                    if eq(and(iszero(left), iszero(right)), 0) {
                        mstore(
                            add(transactionHashesPos, mul(0x20, j)),
                            keccak256(add(transactionHashesPos, mul(mul(0x20, j), 2)), 0x40)
                        )
                    }
                }
            }
            // check if the transaction hashes root calculated equal to the one passed as part of block data
            if eq(
                eq(
                    mload(add(blockPos, mul(sub(blockSlots, 1), 0x20))),
                    mload(transactionHashesPos)
                ),
                0
            ) {
                revert(0, 0)
            }
            // calculate block hash
            blockHash := keccak256(blockPos, mul(blockSlots, 0x20))
        }
        // We need to set the blockHash on chain here, because there is no way to
        // convince a challenge function of the (in)correctness by an offchain
        // computation; the on-chain code doesn't save the pre-image of the hash so
        // it can't tell if it's been given the correct one as part of a challenge.
        // To do this, we simply hash the function parameters because (1) they
        // contain all of the relevant data (2) it doesn't take much gas.
        // All check pass so add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data plus the absolute minimum of metadata - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.

        // blockHash is hash of all block data and hash of all the transactions data.
        blockHashes.push(BlockData({blockHash: blockHash, time: block.timestamp}));
        // Timber will listen for the BlockProposed event as well as
        // nightfall-optimist.  The current, optimistic version of Timber does not
        // require the smart contract to craft NewLeaf/NewLeaves events.
        emit BlockProposed();
    }

    // function to signal a rollback. Note that we include the block hash because
    // it's uinque, although technically not needed (Optimist consumes the
    // block number and Timber the leaf count). It's helpful when testing to make
    // sure we have the correct event.
    function emitRollback(uint256 blockNumberL2ToRollbackTo) public onlyRegistered {
        emit Rollback(blockNumberL2ToRollbackTo);
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

    function getFeeBookInfo(address proposer, uint256 blockNumberL2)
        public
        view
        returns (uint256, uint256)
    {
        bytes32 input = keccak256(abi.encodePacked(proposer, blockNumberL2));
        return (feeBook[input][0], feeBook[input][1]);
    }

    function resetFeeBookInfo(address proposer, uint256 blockNumberL2) public onlyShield {
        bytes32 input = keccak256(abi.encodePacked(proposer, blockNumberL2));
        delete feeBook[input];
    }

    function popBlockData() public onlyChallenger returns (BlockData memory) {
        // oddly .pop() doesn't return the 'popped' element
        BlockData memory popped = blockHashes[blockHashes.length - 1];
        blockHashes.pop();
        return popped;
    }

    function getBlockData(uint256 blockNumberL2) public view returns (BlockData memory) {
        return blockHashes[blockNumberL2];
    }

    function getNumberOfL2Blocks() public view returns (uint256) {
        return blockHashes.length;
    }

    function addPendingWithdrawal(
        address addr,
        uint256 amountEth,
        uint256 amountMatic
    ) public onlyRegistered {
        pendingWithdrawals[addr][0] += amountEth;
        pendingWithdrawals[addr][1] += amountMatic;
    }

    function withdraw() external nonReentrant whenNotPaused {
        uint256 amountEth = pendingWithdrawals[msg.sender][0];
        uint256 amountMatic = pendingWithdrawals[msg.sender][1];

        pendingWithdrawals[msg.sender] = [0, 0];
        if (amountEth > 0) {
            (bool success, ) = payable(msg.sender).call{value: amountEth}('');
            require(success, 'Transfer failed.');
        }
        if (amountMatic > 0) {
            pendingWithdrawals[msg.sender][1] = 0;
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

    function getProposerStartBlock() public view returns (uint256) {
        return proposerStartBlock;
    }

    function setNumProposers(uint256 np) public onlyRegistered {
        numProposers = np;
    }

    function getNumProposers() public view returns (uint256) {
        return numProposers;
    }

    function removeProposer(address proposer) public onlyRegistered {
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
            currentProposer = proposers[currentProposer.thisAddress]; // we need to refresh the current proposer
        }
        if (proposer == currentProposer.thisAddress) {
            proposerStartBlock = 0;
            changeCurrentProposer();
        }
    }

    function updateProposer(address proposer, string calldata url) public onlyProposer {
        proposers[proposer].url = url;
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block). It also checks that the transactions sent as a calldata are all contained
    //in the block by performing its hash and comparing it to the value stored in the block
    function areBlockAndTransactionsReal(Block calldata b, Transaction[] calldata ts)
        public
        view
        returns (bytes32)
    {
        bytes32 blockHash = Utils.hashBlock(b);
        require(
            blockHashes[b.blockNumberL2].blockHash == blockHash,
            'State: This block does not exist'
        );
        bytes32 tranasactionHashesRoot = Utils.hashTransactionHashes(ts);
        require(
            b.transactionHashesRoot == tranasactionHashesRoot,
            'State: Some of these transactions are not in this block'
        );
        return blockHash;
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block).
    function isBlockReal(Block calldata b) public view returns (bytes32) {
        bytes32 blockHash = Utils.hashBlock(b);
        require(blockHashes[b.blockNumberL2].blockHash == blockHash, 'This block does not exist');

        return blockHash;
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block). It also checks if a transaction is contained in a block using its sibling path
    function areBlockAndTransactionReal(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) public view {
        bytes32 blockHash = Utils.hashBlock(b);
        require(
            blockHashes[b.blockNumberL2].blockHash == blockHash,
            'State: This block does not exist'
        );
        require(
            b.transactionHashesRoot == siblingPath[0],
            'State: This transaction hashes root is incorrect'
        );
        bool valid = Utils.checkPath(siblingPath, index, Utils.hashTransaction(t));
        require(valid, 'State: Transaction does not exist in block');
    }

    /**
     * @dev Set stake account for the address addr with amount of stake and challengeLocked
     */
    function setStakeAccount(
        address addr,
        uint256 amount,
        uint256 challengeLocked
    ) public onlyProposer {
        stakeAccounts[addr] = TimeLockedStake(amount, challengeLocked, 0);
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
        uint256 numRemoved
    ) public onlyChallenger {
        removeProposer(proposer);

        TimeLockedStake memory stake = stakeAccounts[proposer];
        // Give reward to challenger from the stake locked for challenges
        stakeAccounts[proposer] = TimeLockedStake(
            stake.amount,
            stake.challengeLocked - numRemoved * BLOCK_STAKE,
            0
        );
        pendingWithdrawals[challengerAddr][0] += numRemoved * BLOCK_STAKE;
    }

    function updateStakeAccountTime(address addr, uint256 time) external onlyProposer {
        TimeLockedStake memory stake = stakeAccounts[addr];
        stake.time = time;
        stakeAccounts[addr] = stake;
    }

    function isBlockStakeWithdrawn(bytes32 blockHash) public view returns (bool) {
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
        require(
            block.number - proposerStartBlock > ROTATE_PROPOSER_BLOCKS || proposerStartBlock == 0,
            'State: Too soon to rotate proposer'
        );

        address addressBestPeer;

        if (numProposers <= 1) {
            currentSprint = 0; // We don't have sprints because always same proposer
            addressBestPeer = currentProposer.thisAddress;
        } else {
            ProposerSet memory peer;
            uint256 totalEffectiveWeight = 0;

            if (currentSprint == SPRINTS_IN_SPAN || proposerStartBlock == 0) {
                currentProposer = proposers[currentProposer.nextAddress]; // it could be removed
                currentSprint = 0;
            }
            if (currentSprint == 0) initializeSpan();

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
        fillSlots(); // 1) initialize slots based on the stake and VALUE_PER_SLOT
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

        // 1) remove all slots
        delete slots;
        // 2) assign slots based on the stake of the proposers
        if (numProposers == 1) {
            stake = getStakeAccount(p.thisAddress);
            weight = stake.amount / VALUE_PER_SLOT;
            for (uint256 i = 0; i < weight; i++) {
                slots.push(p.thisAddress);
            }
        } else {
            while (p.nextAddress != currentProposer.thisAddress) {
                stake = getStakeAccount(p.thisAddress);
                weight = stake.amount / VALUE_PER_SLOT;
                for (uint256 i = 0; i < weight; i++) {
                    slots.push(p.thisAddress);
                }
                p = proposers[p.nextAddress];
            }
            stake = getStakeAccount(p.thisAddress);
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
        for (uint256 i = 0; i < PROPOSER_SET_COUNT; i++) {
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
