// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable the management of private fungible token (ERC-20) transactions using zk-SNARKs.
@Author Westlad, Chaitanya-Konda, iAmMichaelConnor
*/

pragma solidity ^0.6.0;

import "./Ownable.sol";
import "./MerkleTree.sol";
import "./Verifier_Interface.sol";
import "./ERCInterface.sol";

contract Shield is Ownable, MerkleTree {
  // ENUMS:
  enum TransactionTypes { Deposit, Transfer, Withdraw }

  // EVENTS:
  // Observers may wish to listen for nullification of commitments:
  event Transfer(bytes32 nullifier1, bytes32 nullifier2);
  event Withdraw(bytes32 nullifier);
  // Observers may wish to listen for zkSNARK-related changes:
  event VerifierChanged(address newVerifierContract);
  event VkChanged(TransactionTypes txType);
  // For testing only. This SHOULD be deleted before mainnet deployment:
  event GasUsed(uint256 byShieldContract, uint256 byVerifierContract);

  // CONTRACT INSTANCES:
  Verifier_Interface private verifier; // the verification smart contract
  MerkleTree private timber; // the timber contract

  // PRIVATE TRANSACTIONS' PUBLIC STATES:
  mapping(bytes32 => bytes32) public nullifiers; // store nullifiers of spent commitments
  mapping(bytes32 => bytes32) public roots; // holds each root we've calculated so that we can pull the one relevant to the prover
  mapping(TransactionTypes => uint256[]) public vks; // mapped to by an enum uint(TransactionTypes):

  bytes32 public latestRoot; // holds the index for the latest root so that the prover can provide it later and this contract can look up the relevant root

  bytes32 public selectBits248 = 0x0000000000000000ffffffffffffffffffffffffffffffffffffffffffffffff;

  // FUNCTIONS:
  constructor(address _verifier) public {
      _owner = msg.sender;
      verifier = Verifier_Interface(_verifier);
  }

  /**
  self destruct
  */
  function close() external onlyOwner {
      selfdestruct(address(uint160(_owner)));
  }

  /**
  function to change the address of the underlying Verifier contract
  */
  function changeVerifier(address _verifier) external onlyOwner {
      verifier = Verifier_Interface(_verifier);
      emit VerifierChanged(_verifier);
  }

  /**
  returns the verifier-interface contract address that this shield contract is calling
  */
  function getVerifier() public view returns (address) {
      return address(verifier);
  }

  /**
  Stores verification keys (for the 'deposit', 'transfer' and 'withdraw' computations).
  */
  function registerVerificationKey(uint256[] calldata _vk, TransactionTypes _txType) external onlyOwner {
      // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
      vks[_txType] = _vk;
      emit VkChanged(_txType);
  }

  /**
  The deposit function accepts tokens from the specified ERCx contract and creates the same amount as a commitment.
  */
  function deposit(
      bytes32 _publicInputHash,
      bytes32 tokenContractAddress, // Take in as bytes32 for consistent hashing
      bytes32 _tokenId,
      bytes32 _value,
      bytes32 _commitment,
      uint256[] calldata _proof
    ) external {
    // gas measurement:
    uint256 gasCheckpoint = gasleft();

    // Check that the publicInputHash equals the hash of the 'public inputs':
    // we shorten the SHA hash to 248 bits so it fits in one field
    require(
      _publicInputHash == sha256(
        abi.encodePacked(tokenContractAddress, _tokenId, _value, _commitment)
      ) & selectBits248,
      "publicInputHash cannot be reconciled"
    );

    // gas measurement:
    uint256 gasUsedByShieldContract = gasCheckpoint - gasleft();
    gasCheckpoint = gasleft();

    // verify the proof
    require(
      verifier.verify(
        _proof,
        uint256(_publicInputHash),
        vks[TransactionTypes.Deposit]
      ),
      "The proof has not been verified by the contract"
    );

    // gas measurement:
    uint256 gasUsedByVerifierContract = gasCheckpoint - gasleft();
    gasCheckpoint = gasleft();

    // update contract states
    // recalculate the root of the merkleTree as it's now different
    latestRoot = insertLeaf(_commitment);
    // and save the new root to the list of roots
    roots[latestRoot] = latestRoot;

    // Finally, transfer the fTokens from the sender to this contract
    ERCInterface tokenContract = ERCInterface(
        address(uint160(uint256(tokenContractAddress)))
    );
    if (_tokenId == zero && _value == zero) // disallow this corner case
      revert("Minting of zero-value tokens is not allowed");

    if (_tokenId == zero) // must be an ERC20
      require(
        tokenContract.transferFrom(msg.sender, address(this), uint256(_value)),
        "Commitment cannot be minted"
      );
    else if (_value == zero) // must be ERC721
      require(
        tokenContract.safeTransferFrom(
          msg.sender, address(this), uint256(_tokenId), ''
        ),
        "Commitment cannot be minted"
      );
    else // must be an ERC1155
      require(
        tokenContract.safeTransferFrom(
          msg.sender, address(this), uint256(_tokenId), uint256(_value),''
        ),
        "Commitment cannot be minted"
      );


    // gas measurement:
    gasUsedByShieldContract = gasUsedByShieldContract +
      gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByShieldContract, gasUsedByVerifierContract);
  }
}
