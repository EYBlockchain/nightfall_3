// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "https://github.com/paxosglobal/simple-multisig/blob/master/contracts/SimpleMultiSig.sol";

contract MultiSig is SimpleMultiSig {
  constructor(uint threshold, address[] memory owners, uint chainId) SimpleMultiSig(threshold, owners, chainId) {}

  function addSig()
}
