// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';
import './Structures.sol';
import './X509Interface.sol';
import './SanctionsListInterface.sol';

contract Certified is Ownable {
    X509Interface x509;
    SanctionsListInterface sanctionsList;

    function initialize() public virtual override onlyInitializing {
        Ownable.initialize();
    }

    function setAuthorities(address sanctionsListAddress, address x509Address) public onlyOwner {
        x509 = X509Interface(x509Address);
        sanctionsList = SanctionsListInterface(sanctionsListAddress);
    }

    // this modifier checks all of the 'authorisation' contract interfaces to see if we are allowed to transact
    modifier onlyCertified() {
        require(
            x509.x509Check(msg.sender),
            'Certified: You are not authorised to transact using Nightfall'
        );
        require(
            !sanctionsList.isSanctioned(msg.sender),
            'Certified: You are on the Chainalysis sanctions list'
        );
        _;
    }
}
