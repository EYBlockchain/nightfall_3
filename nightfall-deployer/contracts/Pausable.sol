import '@openzeppelin/contracts-upgradeable/security/PauseableUpgradeable.sol';

contract Pausable is PauseableUpgradeable, Initializable {

  address public pauser;

  function initialize() public initializer {
    PauseableUpgradeable.initialize();
    pauser = msg.sender; // pauser and deployer are the same
  }

  modifier onlyPauser {
      // Modifier
      require(
          msg.sender == pauser,
          'Only the pauser can call this.'
      );
      _;
  }

  function pause() external onlyPauser {
    _pause();
  }

  function unpause() external onlyPauser {
    _unpause();
  }
}
