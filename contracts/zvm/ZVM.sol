// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.6.10;

import "./IZVM.sol";
import "./MerkleTree.sol";
import "../zk-snark/IVerifier.sol";
import "../mimc/MiMC_BLS12_377.sol";
import "../access/Ownable.sol";


contract ZVM is IZVM, Ownable, MiMC_BLS12_377 {

    // FUTURE ENHANCEMENTS:
    // Observers may wish to listen for zkSNARK-related changes:
    // event VerifierChanged(address newVerifierContract, TransactionTypes txType);
    // event NewPrivateFunction(
    //     uint256 privateContractAddress,
    //     uint256 _vkID,
    //     uint256[] predators,
    //     uint256[] prey,
    //     uint256 _extensionContractAddress
    // );

    // Struct of a queue (linked list)
    struct Queue {
        uint256 current;
        uint256 next;
    }

    // access via vkID
    struct PrivateFunctionData {
        uint256 vkID; // to check for a nonempty struct
        uint256 privateContractAddress; // reverse lookup
        uint256[] predators;
        uint256[] prey;
        address extensionContractAddress;
    }

    // access via privateContractAddress
    struct PublicStorageData {
        uint256 privateContractAddress; // to check for a nonempty struct
        uint256[] storageVariables;
        uint256 storageRoot;
        uint256 stateLeaf;
    }

    // access via privateContractAddress
    struct PrivateContractData {
        uint256 privateContractAddress; // to check for a nonempty struct
        uint256[] vkIDs;
    }

    // store the nullifiers of spent commitments (nullifier => nullifier)
    mapping(uint256 => uint256) public nullifiers;
    // all commitments (commitment => commitment)
    mapping(uint256 => uint256) public commitments;
    // holds roots of the commitment tree (commitmentRoot => commitmentRoot)
    mapping(uint256 => uint256) public commitmentRoots;
    // holds roots of the vk tree (vkRoot => vkRoot)
    mapping(uint256 => uint256) public vkRoots;
    // holds roots of the public state tree (publicStateRoot => publicStateRoot)
    mapping(uint256 => uint256) public publicStateRoots;
    // Private Contract Addresses (addr => addr)
    mapping(uint256 => uint256) public privateContractAddresses;
    // vkIDs (vkId => vkID)
    mapping(uint256 => uint256) public vkIDs;
    // VKs for outer verification circuits (vkID => vk)
    mapping(uint256 => uint256[]) public outerVKs;
    // VKs for batch commitment insertion circuits (vkID => vk) (future enhancement).
    mapping(uint256 => uint256[]) public batchVKs;
    // VKs for zApps (vkID => vk)
    mapping(uint256 => uint256[]) public vks;
    // PrivateContractData (privateContractAddress => data)
    mapping(uint256 => PrivateContractData) public privateContractData;
    // PrivateFunctionData (vkID => data)
    mapping(uint256 => PrivateFunctionData) public privateFunctionData;
    // PublicStorageData (privateContractAddress => data)
    mapping(uint256 => PublicStorageData) public publicStorageData;
    // A list of pending commitments (commitment => queue)
    mapping(uint256 => Queue) public queue;

    /* the following hold the index for the latest roots so that the prover can provide it later and this contract can look up the relevant root */
    uint256 public latestCommitmentRoot;
    uint256 public latestVKRoot;
    uint256 public latestPublicStateRoot;

    IVerifier private verifier_GM17_BW6_761; // the BW6_761 GM17 verification smart contract
    IVerifier private verifier_GM17_BLS12_377; // the BLS12_377 GM17 verification smart contract

    MerkleTree public commitmentTree;
    MerkleTree public vkTree;
    MerkleTree public publicStateTree;

    uint256 public qStart;
    uint256 public qEnd;

    // FUNCTIONS:
    constructor (
        address _verifier_GM17_BW6_761_Address,
        address _verifier_GM17_BLS12_377_Address
    ) public {
        _owner = msg.sender;

        commitmentTree = new MerkleTree(52);
        vkTree = new MerkleTree(22);
        publicStateTree = new MerkleTree(20);

        verifier_GM17_BW6_761 = IVerifier(_verifier_GM17_BW6_761_Address);
        verifier_GM17_BLS12_377 = IVerifier(_verifier_GM17_BLS12_377_Address);
    }

    /**
    This is a convenience function, provided so that extension contracts' gateway functions may verify zApp-specific zk-SNARKs.
    */
    function verify_GM17_BLS12_377(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256 _vkID
    ) external view override returns (bool result) {
        result = verifier_GM17_BLS12_377.verify(
            _proof,
            _inputs,
            vks[_vkID]
        );
    }

    /**
    self destruct
    */
    function close() external onlyOwner {
        selfdestruct(address(uint160(_owner)));
    }

    function getQueueEntry(uint256 _commitment) public view returns(uint256 current, uint256 next) {
        return (queue[_commitment].current, queue[_commitment].next);
    }

    function getVKIDs(uint256 _privateContractAddress) public view returns (uint256[] memory) {
        return privateContractData[_privateContractAddress].vkIDs;
    }

    function getVK(uint256 _vkID) public view returns (uint256[] memory) {
        return vks[_vkID];
    }

    function getPrivateFunctionData(uint256 _vkID) public view returns (uint256, uint256, uint256[] memory, uint256[] memory, address) {
      PrivateFunctionData memory data = privateFunctionData[_vkID];
      return (
          data.vkID,
          data.privateContractAddress,
          data.predators,
          data.prey,
          data.extensionContractAddress
      );
    }

    function getPublicStorageData(uint256 _privateContractAddress) public view returns (uint, uint256[] memory, uint256, uint256) {
        PublicStorageData memory data = publicStorageData[_privateContractAddress];
        return (
            data.privateContractAddress,
            data.storageVariables,
            data.storageRoot,
            data.stateLeaf
        );
    }

    /*
    Outer-verification vkIDs:
    0x 0.....0numIn  0....0numOut
      |--128 bits--||--128 bits--|
    */
    function getOuterVKID(uint256 numIn, uint256 numOut) public pure returns (uint256) {
        // Very crude value checks.
        // FUTURE ENHANCEMENTS: improve upon this:
        require(numIn <= (2**52), "numIn too large");
        require(numOut <= (2**52), "numIn too large");
        return (numIn << 128) + numOut;
    }

    /*
    Batch vkIDs (for batching commitments):
    0x 00.............0 batchSize
      |--------256 bits----------|

    Note: it's ok for these batchVKIDs to collide with those of the outerVKIDs, because they're stored in separate mappings.
    */
    function getBatchVKID(uint256 batchSize) public pure returns (uint256) {
        require(batchSize <= (2**52), "batch size too big");
        // FUTURE ENHANCEMENTS: batches should also be powers of 2. But batching of commitment leaves is a future enhancement, so we won't think about this yet.
        return batchSize;
    }

    function getOuterVK(uint256 numIn, uint256 numOut) public view returns (uint256[] memory) {
        uint256 vkID = getOuterVKID(numIn, numOut);
        return outerVKs[vkID];
    }

    function getBatchVK(uint256 batchSize) public view returns (uint256[] memory) {
        uint256 vkID = getBatchVKID(batchSize);
        return batchVKs[vkID];
    }

    /*
    Stores verification keys for Core ZVM functionality.
    @param {uint256} _numIn - the number of inputs commitments that are nullified when this VK's circuit is executed
    @param {uint256} _numOut - the number of output commitments that are created and stored when this VK's circuit is executed
    @param {uint256[]} _vk - a flattened verification key
    */
    function registerOuterVK(
        uint256 _numIn,
        uint256 _numOut,
        uint256[] calldata _vk
    ) external onlyOwner {
        uint256 vkID = getOuterVKID(_numIn, _numOut);
        outerVKs[vkID] = _vk;
        // emit VKChanged(_vkID);
    }

    /*
    Stores verification keys for Core ZVM functionality.
    */
    function registerBatchVK(
        uint256 _batchSize,
        uint256[] calldata _vk
    ) external onlyOwner {
        uint256 vkID = getBatchVKID(_batchSize);
        batchVKs[vkID] = _vk;
        // emit VKChanged(_vkID);
    }

    /**
    Stores verification keys for zApps
    */
    function registerVK(
        uint256 _vkID,
        uint256[] calldata _vk
    ) external {
        require(
            vkIDs[_vkID] == _vkID,
            "_vkID not yet registered via 'registerPrivateContract' function"
        );
        require(
            vks[_vkID].length == 0, // empty array
            "vk has already been registered"
        );
        require(
            uint248(_vkID) == uint248(_vk[1]),
            "_vkID does not relate to the _vk"
        );

        vks[_vkID] = _vk;
    }

    function registerPrivateContract(
        uint256 _privateContractAddress,
        uint256[] calldata _vkIDs,
        uint256[] calldata _predators,
        uint256[] calldata _prey,
        uint256[] calldata _vkLeaves,
        uint256[] calldata _storageVariables,
        uint256 _storageRoot,
        uint256 _stateLeaf,
        address[] calldata _extensionContractAddresses
    ) external override {
        registerPrivateContractData(
            _privateContractAddress,
            _vkIDs
        );
        registerPrivateFunctionData(
            _privateContractAddress,
            _vkIDs,
            _predators,
            _prey,
            _vkLeaves,
            _extensionContractAddresses
        );
        registerPublicStorageData(
            _privateContractAddress,
            _storageVariables,
            _storageRoot,
            _stateLeaf
        );
    }

    function registerPrivateContractData(
        uint256 _privateContractAddress,
        uint256[] calldata _vkIDs
    ) private {
        require(
            privateContractAddresses[_privateContractAddress] == 0,
            "A private contract with this address already exists"
        );
        privateContractAddresses[_privateContractAddress] = _privateContractAddress;
        privateContractData[_privateContractAddress] = PrivateContractData(
            _privateContractAddress,
            _vkIDs
        );
    }

    /*
    @param _publicStorageHash holds the root of the merkle tree of depth 4 which holds the public storage
    variables of a private contract
    @param _publicStorageVariables holds the variables that are hashed to create _publicStorageHash
    @param _vkLeaves is the Hash of vkID and hash of Predator + Prey
    @param _extensionContractAddresses pass 0x00 if no extension contract exists for the vkID
    Not calculating _publicStorageHash as well as _vkLeaves on chain because it is cheaper to pass them as arguments.
    TO DO Users of this private contract will have to verify this before interacting with it */
    function registerPrivateFunctionData(
        uint256 _privateContractAddress,
        uint256[] calldata _vkIDs,
        uint256[] calldata _predators,
        uint256[] calldata _prey,
        uint256[] calldata _vkLeaves,
        address[] calldata _extensionContractAddresses
    ) private {
        for (uint256 i = 0; i < _vkIDs.length; i++) {
            require(
                vkIDs[_vkIDs[i]] == 0,
                "A private function with this vkID already exists"
            );
            vkIDs[_vkIDs[i]] = _vkIDs[i];

            uint256[] memory predators = new uint256[](4);
            uint256[] memory prey = new uint256[](4);

            for (uint256 j = 0; j < 4; j++){
                predators[j] = _predators[(4 * i) + j];
                prey[j] = _prey[(4 * i) + j];
            }

            privateFunctionData[_vkIDs[i]] = PrivateFunctionData(
                _vkIDs[i],
                _privateContractAddress,
                predators, // _predators[4 * i : (4 * i + 2)],
                prey, // _prey[4 * i : (4 * i + 3)],
                _extensionContractAddresses[i]
            );
        }

        // new scope, to avoid stack too deep:
        {
            uint256 vkRoot = vkTree.insertLeaves(_vkLeaves);
            vkRoots[vkRoot] = vkRoot;
            latestVKRoot = vkRoot;
        }
    }

    function registerPublicStorageData(
        uint256 _privateContractAddress,
        uint256[] calldata _storageVariables,
        uint256 _storageRoot,
        uint256 _stateLeaf
    ) private {
        require(
            publicStorageData[_privateContractAddress].privateContractAddress == 0,
            "Public storage already exists for this private contract address"
        );
        publicStorageData[_privateContractAddress] = PublicStorageData(
            _privateContractAddress,
            _storageVariables,
            _storageRoot,
            _stateLeaf
        );

        {
          uint256 stateRoot = publicStateTree.insertLeaf(_stateLeaf);
          publicStateRoots[stateRoot] = stateRoot;
          latestPublicStateRoot = stateRoot;
        }
    }

    function addNullifiers(uint256[] memory _nullifiers) private {
        // Add the nullifiers to the nullifiers mapping
        // Check nullifiers don't exist in the nullifiers mapping.
        for (uint256 i = 0; i < _nullifiers.length; i++) {
            require(
                nullifiers[_nullifiers[i]] == 0,
                "The nullifier being added already exist"
            );
            nullifiers[_nullifiers[i]] = _nullifiers[i]; //remember we spent it
        }
    }

    // event DEBUG(uint256[] outerNullifiers, uint256[] outerCommitments, uint256 comRoot, uint256 vkRoot, uint256 stateRoot, uint256[] inputHash, uint256 calculatedHash);

    /**
      PRIVATE FUNCTION EXECUTION
      Verifies the execution of a function, without revealing which function has been executed.
    */
    function executePrivateFunction(
        uint256[] calldata _proof,
        uint256[] calldata _publicInputsHash, // 377-bits
        uint256[] calldata _outerNullifiers,
        uint256[] memory _newOuterCommitments,
        uint256 _commitmentRoot,
        uint256 _vkRoot,
        uint256 _publicStateRoot
    ) external override {

        // Check commitmentRoot against historic commitmentRoots.
        // Even if a commitmentRoot is irrelevant to the private function being executed, the latest root should be specified, so as to not reveal that "this private function is one of the ones which doesn't refer to the commitmentRoot".
        require(
            commitmentRoots[_commitmentRoot] == _commitmentRoot,
            "The input commitment root has never been the root of the Merkle Tree"
        );
        // Check vkRoot against historic vkRoots.
        require(
            vkRoots[_vkRoot] == _vkRoot,
            "The input vk root has never been the root of the Merkle Tree"
        );
        // Check publicStateRoot against historic publicStateRoots.
        // Even if a publicStateRoot is irrelevant to the private function being executed, the latest root should be specified, so as to not reveal that "this private function is one of the ones which doesn't refer to the publicStateRoot".
        require(
            publicStateRoots[_publicStateRoot] == _publicStateRoot,
            "The input public state root has never been the root of the Merkle Tree"
        );
        // Check publicInputsHash:
        // publicInputsHash is 377-bits, but produced with sha256, so only 256-bits of nonzero info.

        // FOR DEBUGGING:
        // {
        //   uint256 calculatedHash = uint256(sha256(
        //       abi.encodePacked(
        //           _outerNullifiers,
        //           _newOuterCommitments,
        //           _commitmentRoot,
        //           _vkRoot,
        //           _publicStateRoot
        //       )
        //   ));
        //   emit DEBUG(_outerNullifiers, _newOuterCommitments, _commitmentRoot, _vkRoot, _publicStateRoot, _publicInputsHash, calculatedHash);
        // }

        require(
            _publicInputsHash[1] == uint256(sha256(
                abi.encodePacked(
                    _outerNullifiers,
                    _newOuterCommitments,
                    _commitmentRoot,
                    _vkRoot,
                    _publicStateRoot
                )
            )),
            "publicInputsHash not reconciled"
        );

        /*
          Verify the proof & publicInputsHash against the relevant execution VK. (There will be a VK for every (m, n) permutation of nullifying m commitments and adding n commitments).
        */
        bool result = verifier_GM17_BW6_761.verify(
            _proof,
            _publicInputsHash,
            getOuterVK(
                _outerNullifiers.length,
                _newOuterCommitments.length
            )
        );
        require(result, "The proof has not been verified by the verifier contract");

        // FUTURE ENHANCEMENTS: reintroduce queueing eventually, to save lots of gas.
        // addToQueue(_newCommitments);

        // FUTURE ENHANCEMENTS: FILTER OUT / IGNORE IF COMMITMENT = 0
        latestCommitmentRoot = commitmentTree.insertLeaves(_newOuterCommitments);
        commitmentRoots[latestCommitmentRoot] = latestCommitmentRoot;

        // FUTURE ENHANCEMENTS: FILTER OUT / IGNORE IF NULLIFIER = 0
        addNullifiers(_outerNullifiers);
    }

    /**
      (VISIBLE) GATEWAY FUNCTION EXECUTION
      This function MUST be called from an external ‘Extension Contract’, the address of which must be pre-registered as THE ONLY contract permitted to use the given vkID.
      The calling 'Extension Contract' MUST perform checks on the validity of the commitments and nullifiers. Other private contracts are siloed (protected), as the outerNullifiers and outerCommitments include the vkID.
      */
    function executeGatewayFunction(
        uint256 _vkID,
        uint256[] calldata _innerNullifiers,
        uint256[] calldata _newInnerCommitments
    ) external override {

        // Check that the calling Extension Contract’s address is a permitted address which may use this vkID
        require(
            privateFunctionData[_vkID].extensionContractAddress == msg.sender,
            "The calling contract is not permitted to use this vk"
        );

        // ‘Stamp’ each inner commitment and each inner nullifier with the _vkID of its parentVK.
        // Note: For the PRIVATE `execute()` function, this check is instead done within the inner-checks circuit, rather than on-chain. */
        uint256[] memory outerNullifiers = new uint256[](_innerNullifiers.length);
        uint256[] memory newOuterCommitments = new uint256[](_newInnerCommitments.length);

        uint256[] memory preimage = new uint256[](2);
        for (uint256 i = 0; i < _innerNullifiers.length; i++) {
            preimage[0] = _vkID;
            preimage[1] = _innerNullifiers[i];
            outerNullifiers[i] = mimcHash(preimage);
        }
        for (uint256 i = 0; i < _newInnerCommitments.length; i++) {
            preimage[0] = _vkID;
            preimage[1] = _newInnerCommitments[i];
            newOuterCommitments[i] = mimcHash(preimage);
        }

        // FUTURE ENHANCEMENTS: potentially other vk checks. See inner-checks.zok for details

        // FUTURE ENHANCEMENTS: reintroduce queueing eventually, to save lots of gas.
        // addToQueue(newOuterCommitments);

        // FUTURE ENHANCEMENTS: FILTER OUT / IGNORE IF COMMITMENT = 0
        latestCommitmentRoot = commitmentTree.insertLeaves(newOuterCommitments);
        commitmentRoots[latestCommitmentRoot] = latestCommitmentRoot;

        // FUTURE ENHANCEMENTS: FILTER OUT / IGNORE IF NULLIFIER = 0
        addNullifiers(outerNullifiers);
    }

    // FUTURE ENHANCEMENTS:

    function updateCommitmentRoot(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256 _root,
        uint256[] calldata _commitments
    ) external override {

        // bool result = verifier_GM17_BLS12_377.verify(
        //     _proof,
        //     _inputs,
        //     // vks[getBatchVKID(_commitments.length)]
        // );
        // require(
        //     result,
        //     "The proof has not been verified by the contract"
        // );

        // Check commitmentRoot against historic commitmentRoots.
        require(
            commitmentRoots[_root] == 0,
            "The commitment root has already been the root of the Merkle Tree"
        );

        // Check if this commitment already exists if not, then add
        for (uint256 i = 0; i < _commitments.length; i++) {
            require(
                commitments[_commitments[i]] == 0,
                "The commitment being added already exists"
            );
            commitments[_commitments[i]] = _commitments[i];
        }

        // Check if the commitments being confirmed are taken in the correct order of pending pool
        require(
            qStart == queue[_commitments[0]].current,
            "Commitment not batched in order"
        );
        uint256 next = qStart;

        // update qStart
        qStart = queue[_commitments[_commitments.length-1]].next;
        for (uint256 i = 0; i < _commitments.length; i++) {
            require(
                queue[next].current == _commitments[i],
                "Commitment not batched in order"
            );
            next = queue[_commitments[i]].next;
            delete queue[_commitments[i]];
        }

        // Check that the publicInputsHash equals the hash of the 'public inputs':
        uint256 publicInputsHash = _inputs[0] << 8;

        // HASH is either MIMC or SHA256
        // uint256 publicInputsHashCheck = uint256(
        //   HASH(
        //     abi.encodePacked(
        //       _root,
        //       _commitments
        //     )
        //   ) << 8
        // );
        // require(
        //     publicInputsHashCheck == publicInputsHash,
        //     "publicInputsHash cannot be reconciled"
        // );

        // recalculate the root of the merkleTree as it's now different
        /* Event emitted from MerkleTree with all the leaves in Commitment tree.
        All listeners will subscribe to this event */
        latestCommitmentRoot = commitmentTree.insertLeaves(_commitments);
        require(
            latestCommitmentRoot == _root,
            "The input root has never been the root of the Merkle Tree"
        );
        commitmentRoots[latestCommitmentRoot] = latestCommitmentRoot; // and save the new root to the list of roots
    }

    function addToQueue(uint256[] memory _commitments) private {
        // Check if each commitment already exists. If not, add to the queue.
        require(
            commitments[_commitments[0]] == 0,
            "The commitment being added already exists"
        );
        require(
            queue[_commitments[0]].current == 0,
            "The commitment being added already is already pending"
        );
        if (qEnd != 0) { // queue is not empty
            queue[qEnd].next = _commitments[0]; // add to end of queue
        }
        if (qStart == 0) { // queue is empty
            qStart = _commitments[0]; // begin queue
        }
        queue[_commitments[0]].current = _commitments[0];

        if (_commitments.length > 1) {
            uint256 last = _commitments[0];
            for (uint256 i = 1; i < _commitments.length; i++) {
                require(
                    commitments[_commitments[i]] == 0,
                    "The commitment being added already exists"
                );
                require(
                    queue[_commitments[i]].current == 0,
                    "The commitment being added already is already pending"
                );
                queue[last].next = _commitments[i];
                queue[_commitments[i]].current = _commitments[i];
                last = _commitments[i];
            }
        }

        qEnd = _commitments[_commitments.length - 1];
    }

}
