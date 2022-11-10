# Know Your Customer Functionality in Nightfall
Know Your Customer (KYC) functionality has been added to nightfall to assist with regulatory compliance requirements. It is architected as a layer on top of Nightfall's [Whitelisting](./whitelist.md) functionality. Thus, it operates only when Whitelisting is enabled.

It is intended that KYC functionality is pluggable so that Nightfall itself is KYC agnostic. Currently, X509 certificate based KYC is implemented (`X509.sol`).  Others forms of KYC may be added if required by using a different smart contract as a KYC implementer. The contract must extend the Whitelist manager and expose the KYC interface (`KYCInterfce.sol`).  It is the responsibility of the user to determine if this is adequate for their particular regulatory environment.

`X509.sol` can check the validity of a passed-in X509 certificate (in DER format) against a root of trust that the contract knows (these can be added by the contract owner).  If the certificate is valid (in date, signature good, appropriate key usage extensions, links to known trusted public key), then the owner of the certificate will be whitelisted. Note that only RSA cryptography is currently supported. A certificate chain can be added by passing in successive certificates until the end-user certificate is reached.

Of course, certificates are public, so we need to be sure that it's actually the certificate owner that passed it to the contract and not anyone else. To achieve that, we get the owner to sign their ethereum address with the private key that corresponds to their certificate. This must also be the address that passes in the certificate (all done as one transaction), so that front-running is prevented. The main contract API functions are:

`function validateCertificate(bytes calldata certificate, uint256 tlvLength, bytes calldata addressSignature, bool addAddress) external;`

This function takes in: a DER encoded X509 (RSA) certificate (`bytes calldata certificate`); the number of Tag-Length-Value items in the certificate (which can be calculated by calling `function computeNumberOfTlvs(certificate, 0)` and passing the certificate in); a signature over `msg.sender` using the private key corresponsing to the certificate (PKCS #1 format); and a `bool` which indicates whether this is an intermediate certificate in a chain, or the end-user certificate, in which case `msg.sender` will be whitelisted following successful validation. Note that, if a chain of certificates is required, these should be possed in in order, with the first certificate being one that is signed by a key trusted by the smart contract.  Once that certificate is validated, its public key will be added to the list of trusted keys and the next certificate in the chain can be passed in, until finally the end-user certificate is reached. The function will reject any intermediate certificate which does not have the Certificate Sign key usage flag set and any end-user certificate which does not have the Digital Signature and Non-Repudiation key usage flags set. It will also reject any certificates that are not in-date or whose signature does not verify against a know trusted key.

`function setUseageBitMaskEndUser(bytes1 _usageBitMask) external onlyOwner;`

This function can be used by the contract owner to change the key usage flags that are applied to an end-user certificate. The value should be computed by calculating the bitmask for each flag and reversing the bits after calculating to make it little endian. (DER flag encoding is somewhat complex).

`function setUseageBitMaskIntermediate(bytes1 _usageBitMask) external onlyOwner;`

As above, but for an intermediate certificate.

 `function setTrustedPublicKey( RSAPublicKey calldata trustedPublicKey, bytes32 keyIdentifier) external onlyOwner;`

 This function can be used to add a trusted public key `RSAPublicKey` is a struct `{ bytes modulus, uint256 exponent}`, along with an identifier for the key, which should normally be the same as the one in the corresponding certificate because that is used to look up a key to check a certificate's signature.

 `function kycCheck(address user) external view returns (bool);`

 This is required by the KYC Interface and returns true, in the present case, if the user is whitelisted and their certificate is still in date and hasn't been revoked locally.

 `function revokeKey(bytes32 subjectKeyIdentifier) external;`

 This function allows the address that passed in a certificate to revoke its corresponding key. Note that only the owner of the certificate or the owner of the contract can do this. It's intended to be used in the event of a key compromise.
