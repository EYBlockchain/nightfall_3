// SPDX-License-Identifier: CC0-1.0
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
/**
Contract to hold global state that is needed by a number of other contracts,
together with functions for mutating it.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Structures.sol';
import './Utils.sol';
import './Config.sol';

contract State is Structures, Initializable, ReentrancyGuardUpgradeable, Config {
    // global state variables
    BlockData[] public blockHashes; // array containing mainly blockHashes
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => LinkedAddress) public proposers;
    mapping(address => TimeLockedBond) public bondAccounts;
    mapping(bytes32 => bool) public claimedBlockStakes;
    LinkedAddress public currentProposer; // who can propose a new shield state
    uint256 public proposerStartBlock; // L1 block where currentProposer became current
    // local state variables
    address public proposersAddress;
    address public challengesAddress;
    address public shieldAddress;

    function initialize(
        address _proposersAddress,
        address _challengesAddress,
        address _shieldAddress
    ) public initializer {
        proposersAddress = _proposersAddress;
        challengesAddress = _challengesAddress;
        shieldAddress = _shieldAddress;
        Config.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    modifier onlyRegistered {
        require(
            msg.sender == proposersAddress ||
                msg.sender == challengesAddress ||
                msg.sender == shieldAddress,
            'This address is not authorised to call this function'
        );
        _;
    }

    modifier onlyCurrentProposer {
        // Modifier
        require(
            msg.sender == currentProposer.thisAddress,
            'Only the current proposer can call this.'
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
    {
        require(b.blockNumberL2 == blockHashes.length, 'The block is out of order'); // this will fail if a tx is re-mined out of order due to a chain reorg.
        if (blockHashes.length != 0)
            require(
                b.previousBlockHash == blockHashes[blockHashes.length - 1].blockHash,
                'The block is flawed or out of order'
            ); // this will fail if a tx is re-mined out of order due to a chain reorg.
        require(BLOCK_STAKE <= msg.value, 'The stake payment is incorrect');
        require(b.proposer == msg.sender, 'The proposer address is not the sender');
        // set the maximum tx/block to prevent unchallengably large blocks
        require(t.length < 33, 'The block has too many transactions');

        bytes32 blockHash;
        assembly {
            let blockPos := mload(0x40) // get empty memory location pointer
            calldatacopy(blockPos, 4, add(mul(t.length, 0x300), 0x100)) // copy calldata into this location. 0x300 is 768 bytes of data for each transaction. 0x100 is 192 bytes of block data, 32 bytes for transactions array memory and size each. TODO skip this by passing parameters in memory. But inline assembly to destructure struct array is not straight forward
            let transactionPos := add(blockPos, 0x100) // calculate memory location of transactions data copied
            let transactionHashesPos := add(transactionPos, mul(t.length, 0x300)) // calculate memory location to store transaction hashes to be calculated
            // calculate and store transaction hashes
            for {
                let i := 0
            } lt(i, t.length) {
                i := add(i, 1)
            } {
                mstore(
                    add(transactionHashesPos, mul(0x20, i)),
                    keccak256(add(transactionPos, mul(0x300, i)), 0x300)
                )
            }
            let transactionHashesRoot
            // calculate and store transaction hashes root
            for {
                let i := 5
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
                        transactionHashesRoot := 0
                    } // returns bool
                    if eq(and(iszero(left), iszero(right)), 0) {
                        transactionHashesRoot := keccak256(
                            add(transactionHashesPos, mul(mul(0x20, j), 2)),
                            0x40
                        )
                    } // returns bool
                    mstore(add(transactionHashesPos, mul(0x20, j)), transactionHashesRoot)
                }
            }
            // check if the transaction hashes root calculated equal to the one passed as part of block data
            if eq(eq(mload(add(blockPos, mul(5, 0x20))), transactionHashesRoot), 0) {
                revert(0, 0)
            }
            // calculate block hash
            blockHash := keccak256(blockPos, mul(6, 0x20))
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
    function emitRollback(uint256 blockNumberL2ToRollbackTo, uint256 leafCountToRollbackTo)
        public
        onlyRegistered
    {
        emit Rollback(
            blockHashes[blockNumberL2ToRollbackTo].blockHash,
            blockNumberL2ToRollbackTo,
            leafCountToRollbackTo
        );
    }

    function setProposer(address addr, LinkedAddress memory proposer) public onlyRegistered {
        proposers[addr] = proposer;
    }

    function getProposer(address addr) public view returns (LinkedAddress memory) {
        return proposers[addr];
    }

    function deleteProposer(address addr) public onlyRegistered {
        delete proposers[addr];
    }

    function setCurrentProposer(address proposer) public onlyRegistered {
        currentProposer = proposers[proposer];
    }

    function getCurrentProposer() public view returns (LinkedAddress memory) {
        return currentProposer;
    }

    function pushBlockData(BlockData memory bd) public onlyRegistered {
        blockHashes.push(bd);
    }

    function popBlockData() public onlyRegistered returns (BlockData memory) {
        // oddly .pop() doesn't return the 'popped' element
        BlockData memory popped = blockHashes[blockHashes.length - 1];
        blockHashes.pop();
        return popped;
    }

    function getBlockData(uint256 blockNumberL2) public view returns (BlockData memory) {
        return blockHashes[blockNumberL2];
    }

    /*
  return all of the block data as an array.  This lets us do off-chain
  reverse lookups
  */
    function getAllBlockData() public view returns (BlockData[] memory) {
        return blockHashes;
    }

    function getNumberOfL2Blocks() public view returns (uint256) {
        return blockHashes.length;
    }

    function getLatestBlockHash() public view returns (bytes32) {
        if (blockHashes.length != 0) return blockHashes[blockHashes.length - 1].blockHash;
        else return Config.ZERO;
    }

    function addPendingWithdrawal(address addr, uint256 amount) public onlyRegistered {
        pendingWithdrawals[addr] += amount;
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        pendingWithdrawals[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}('');
        require(success, 'Transfer failed.');
    }

    function setProposerStartBlock(uint256 sb) public onlyRegistered {
        proposerStartBlock = sb;
    }

    function getProposerStartBlock() public view returns (uint256) {
        return proposerStartBlock;
    }

    function removeProposer(address proposer) public onlyRegistered {
        address previousAddress = proposers[proposer].previousAddress;
        address nextAddress = proposers[proposer].nextAddress;
        delete proposers[proposer];
        proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
        proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
        // Cannot just call changeCurrentProposer directly due to the require time check
        //change currentProposer to next aaddress irrespective of whether proposer is currentProposer
        proposerStartBlock = block.number;
        currentProposer = proposers[nextAddress];
        emit NewCurrentProposer(currentProposer.thisAddress);
    }

    function updateProposer(address proposer, string memory url) public onlyRegistered {
        proposers[proposer].url = url;
    }

    // Checks if a block is actually referenced in the queue of blocks waiting
    // to go into the Shield state (stops someone challenging with a non-existent
    // block).
    function areBlockAndTransactionsReal(Block memory b, Transaction[] memory ts)
        public
        view
        returns (bytes32)
    {
        bytes32 blockHash = Utils.hashBlock(b);
        require(blockHashes[b.blockNumberL2].blockHash == blockHash, 'This block does not exist');
        bytes32 tranasactionHashesRoot = Utils.hashTransactionHashes(ts);
        require(
            b.transactionHashesRoot == tranasactionHashesRoot,
            'Some of these transactions are not in this block'
        );
        return blockHash;
    }

    function areBlockAndTransactionReal(
        Block memory b,
        Transaction memory t,
        uint256 index,
        bytes32[6] memory siblingPath
    ) public view {
        bytes32 blockHash = Utils.hashBlock(b);
        require(blockHashes[b.blockNumberL2].blockHash == blockHash, 'This block does not exist');
        require(
            b.transactionHashesRoot == siblingPath[0],
            'This transaction hashes root is incorrect'
        );
        bool valid = Utils.checkPath(siblingPath, index, Utils.hashTransaction(t));
        require(valid, 'Transaction does not exist in block');
    }

    function setBondAccount(address addr, uint256 amount) public onlyRegistered {
        bondAccounts[addr] = TimeLockedBond(amount, 0);
    }

    function getBondAccount(address addr) public view returns (TimeLockedBond memory) {
        return bondAccounts[addr];
    }

    function rewardChallenger(
        address challengerAddr,
        address proposer,
        uint256 numRemoved
    ) public onlyRegistered {
        removeProposer(proposer);
        TimeLockedBond memory bond = bondAccounts[proposer];
        bondAccounts[proposer] = TimeLockedBond(0, 0);
        pendingWithdrawals[challengerAddr] += bond.amount + numRemoved * BLOCK_STAKE;
    }

    function updateBondAccountTime(address addr, uint256 time) public onlyRegistered {
        TimeLockedBond memory bond = bondAccounts[addr];
        bond.time = time;
        bondAccounts[addr] = bond;
    }

    function isBlockStakeWithdrawn(bytes32 blockHash) public view returns (bool) {
        return claimedBlockStakes[blockHash];
    }

    function setBlockStakeWithdrawn(bytes32 blockHash) public onlyRegistered {
        claimedBlockStakes[blockHash] = true;
    }
}
