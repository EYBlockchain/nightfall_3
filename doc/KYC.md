# Know Your Customer Functionality in Nightfall
Know Your Customer (KYC) functionality has been added to nightfall to assist with regulatory compliance requirements. It is architected as a layer on top of Nightfall's [Whitelisting](./whitelist.md) functionality. Thus, it operates only when Whitelisting is enabled.

It is intended that KYC functionality is pluggable so that Nightfall itse;f is KYC agnostic. Currently, two forms of KYC are implemented.  Others may be added if required simply by adding a smart contract as a whitelist manager.  It is the responsibility of the user to determine of these are adequate for their particular regulatory environment.  These are manual KYC and X509 certificate based.

## Manual KYC
With manual KYC the whitelist managers are external accounts (machine or human controled), and they make decisions to whitelist users on the basis of locally determined rules. Whitelist managers are set at the time of deployment and can also be added/removed via the administrator container.

## X509 Certificate
This adds a contract (`X509.sol`) that can check the validity of a passed-in X509 certificate (in DER format) against a root of trust that the contract knows (these can be added by the contract owner).  If the certificate is valid (in date, signature good, links to known trusted public key), then the owner of the certificate will be whitelisted. Note that only RSA cryptography is currently supported. A certificate chain can be added by passing in successive certificates until the end-user certificate is reached.

Of course, certificates are public, so how do we know it's actually the owner that passed the certificate to the contract? We get the owner to sign their ethereum address with the private key that corresponds to their certificate. This must also be the address that passes in the certificate (all done as one transaction), so that front-running is prevented.

