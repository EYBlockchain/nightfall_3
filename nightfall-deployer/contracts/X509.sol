// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.3;

// This contract can parse  a suitably encoded SSL certificate
import './DerParser.sol';
import './Whitelist.sol';
import './KYCInterface.sol';

contract X509 is DERParser, Whitelist, KYCInterface {
    uint256 constant SECONDS_PER_DAY = 24 * 60 * 60;
    int256 constant OFFSET19700101 = 2440588;

    struct RSAPublicKey {
        bytes modulus;
        uint256 exponent;
    }

    mapping(address => uint256) expires;
    mapping(bytes32 => RSAPublicKey) trustedPublicKeys;
    mapping(bytes32 => bool) revokedKeys;
    mapping(address => bytes32) keysByUser;

    bytes1 usageBitMask;

    function initialize() public override(Whitelist) initializer {
        Whitelist.initialize();
        usageBitMask = 0xC0;
    }

    function setUseageBitMask(bytes1 _usageBitMask) external onlyOwner {
        usageBitMask = _usageBitMask;
    }

    function setTrustedPublicKey(
        RSAPublicKey calldata trustedPublicKey,
        bytes32 authorityKeyIdentifier
    ) external onlyOwner {
        //TODO some validation here
        trustedPublicKeys[authorityKeyIdentifier] = trustedPublicKey;
    }

    function getSignature(DecodedTlv[] memory tlvs, uint256 maxId)
        private
        pure
        returns (bytes memory)
    {
        DecodedTlv memory signatureTlv = tlvs[maxId - 1];
        require(signatureTlv.depth == 1, 'Signature tlv depth is incorrect');
        require(
            signatureTlv.tag.tagType == 0x03,
            'Signature tlv should have a tag type of BIT STRING'
        );
        bytes memory signature = signatureTlv.value;
        return signature;
    }

    function getMessage(DecodedTlv[] memory tlvs) private pure returns (bytes memory) {
        DecodedTlv memory messageTlv = tlvs[1];
        require(messageTlv.depth == 1, 'Message tlv depth is incorrect');
        require(messageTlv.tag.tagType == 0x10, 'Message tlv should have a tag type of BIT STRING');
        bytes memory message = messageTlv.octets;
        return message;
    }

    function modExp(
        bytes memory b,
        uint256 e,
        bytes memory m
    ) internal view returns (bytes memory) {
        bool success;
        bytes memory result;
        (success, result) = (
            address(5).staticcall(abi.encodePacked(b.length, uint256(32), m.length, b, e, m))
        );
        require(success, 'modExp error');
        return result;
    }

    /*
    Validate the decrypted signature and returns the message hash
    */
    function validateSignatureAndExtractMessageHash(bytes memory decrypt, uint256 tlvLength)
        private
        view
        returns (bytes memory)
    {
        DecodedTlv[] memory tlvs = new DecodedTlv[](tlvLength);
        require(
            decrypt[0] == 0x00 && decrypt[1] == 0x00,
            'Decrypt does not have a leading zero octets'
        );
        require(
            decrypt[2] == 0x00 || decrypt[2] == 0x01,
            'Block Type is not a private key operation'
        );
        // loop through the padding
        uint256 i;
        for (i = 3; i < decrypt.length; i++) {
            if (decrypt[i] != 0xff) break;
        }
        i++;
        tlvs = this.parseDER(decrypt, i, tlvLength);
        require(
            tlvs[4].depth == 1 && tlvs[4].tag.tagType == 0x04,
            'Incorrect tag or position for decrypted hash data'
        );
        bytes memory messageHashFromSignature = tlvs[4].value;

        return messageHashFromSignature;
    }

    // note: this function is from an MIT licensed library, with appreciation to
    // https://github.com/bokkypoobah/BokkyPooBahsDateTimeLibrary/blob/v1.01/contracts/BokkyPooBahsDateTimeLibrary.sol
    // minor changes made
    function timestampFromDate(bytes memory utcTime) private pure returns (uint256 _seconds) {
        uint256 year = uint256(uint8(utcTime[0]) - 48) *
            10 +
            uint256(uint8(utcTime[1]) - 48) +
            2000;
        uint256 month = uint256(uint8(utcTime[2]) - 48) * 10 + uint256(uint8(utcTime[3]) - 48);
        uint256 day = uint256(uint8(utcTime[4]) - 48) * 10 + uint256(uint8(utcTime[5]) - 48);
        require(year >= 1970);
        int256 _year = int256(year);
        int256 _month = int256(month);
        int256 _day = int256(day);

        int256 __days = _day -
            32075 +
            (1461 * (_year + 4800 + (_month - 14) / 12)) /
            4 +
            (367 * (_month - 2 - ((_month - 14) / 12) * 12)) /
            12 -
            (3 * ((_year + 4900 + (_month - 14) / 12) / 100)) /
            4 -
            OFFSET19700101;

        _seconds = uint256(__days) * SECONDS_PER_DAY;
    }

    // this function finds and checks the Not Before and Not After tlvs
    // TODO this and the subsequent function loop over the tlvs twice - this is inefficient - refactor code
    function checkDates(DecodedTlv[] memory tlvs) private view returns (uint256) {
        // The Not Before and Not After dates are the third SEQUENCE at depth 2
        uint256 i;
        uint256 j;
        for (i = 0; i < tlvs.length; i++) {
            if (tlvs[i].tag.tagType == 0x10 && tlvs[i].depth == 2) j++;
            if (j == 3) break;
        }
        require(tlvs[i + 1].tag.tagType == 0x17, 'First tag was not in fact a UTC time');
        require(tlvs[i + 2].tag.tagType == 0x17, 'Second tag was not in fact a UTC time');
        require(
            block.timestamp > timestampFromDate(tlvs[i + 1].value),
            'It is too early to use this certificate'
        );
        uint256 expiry = timestampFromDate(tlvs[i + 2].value);
        require(block.timestamp < expiry, 'This certificate has expired');
        return expiry;
    }

    function extractPublicKey(DecodedTlv[] memory tlvs) private view returns (RSAPublicKey memory) {
        // The public key data begins at the 5th SEQUENCE at depth 2
        uint256 i;
        uint256 j;
        for (i = 0; i < tlvs.length; i++) {
            if (tlvs[i].tag.tagType == 0x10 && tlvs[i].depth == 2) j++;
            if (j == 5) break;
        }
        // check we have RSA encryption. We use the keccak hash to check equality of the byte arrays
        require(
            keccak256(tlvs[i + 2].value) ==
                keccak256(abi.encodePacked(bytes9(0x2a864886f70d010101))),
            'Only RSA ecryption keys are supported, the OID indicates a different key type'
        );
        bytes memory keyBytes = tlvs[i + 4].value;
        // extract the public key tlvs
        DecodedTlv[] memory keyTlvs = new DecodedTlv[](10);
        keyTlvs = this.parseDER(keyBytes, 1, 10);
        bytes memory modulus = keyTlvs[1].value;
        uint256 exponent = uint256(
            bytes32(keyTlvs[2].value) >> ((32 - keyTlvs[2].value.length) * 8)
        );
        return RSAPublicKey(modulus, exponent);
    }

    function extractSubjectKeyIdentifier(DecodedTlv[] memory tlvs) private view returns (bytes32) {
        // // The SKID begins after the Suject Key Identifier OID at depth 5
        uint256 i;
        for (i = 0; i < tlvs.length; i++) {
            if (tlvs[i].depth != 5) continue;
            if (
                bytes32(tlvs[i].value) ==
                bytes32((0x551d0e0000000000000000000000000000000000000000000000000000000000))
            ) break; // OID for the SKID
        }
        require(i < tlvs.length, 'OID for Subject Key Identifier not found');
        bytes memory skidBytes = tlvs[i + 1].value;
        require(skidBytes.length < 33, 'SKID is too long to encode as a bytes 32');
        DecodedTlv[] memory skidTlvs = new DecodedTlv[](1);
        skidTlvs = this.parseDER(skidBytes, 0, 2);
        bytes32 skid = bytes32(skidTlvs[0].value) >> ((32 - skidTlvs[0].length) * 8);
        return skid;
    }

    function extractAuthorityKeyIdentifier(DecodedTlv[] memory tlvs)
        private
        view
        returns (bytes32)
    {
        // // The AKID begins after the Authority Key Identifier OID at depth 5
        uint256 i;
        for (i = 0; i < tlvs.length; i++) {
            if (tlvs[i].depth != 5) continue;
            if (
                bytes32(tlvs[i].value) ==
                bytes32((0x551d230000000000000000000000000000000000000000000000000000000000))
            ) break; // OID for the AKID
        }
        require(i < tlvs.length, 'OID for Authority Key Identifier not found');
        bytes memory akidBytes = tlvs[i + 1].value;
        require(akidBytes.length < 33, 'AKID is too long to encode as a bytes 32');
        DecodedTlv[] memory akidTlvs = new DecodedTlv[](3);
        akidTlvs = this.parseDER(akidBytes, 0, 2);
        bytes32 akid = bytes32(akidTlvs[1].value) >> ((32 - akidTlvs[1].value.length) * 8);
        return akid;
    }

    function checkKeyUsage(DecodedTlv[] memory tlvs, bytes1 _usageBitMask) private view {
        // // The key usage sequence begins after the Key Usage OID at depth 5
        uint256 i;
        for (i = 0; i < tlvs.length; i++) {
            if (tlvs[i].depth != 5) continue;
            if (
                bytes32(tlvs[i].value) ==
                bytes32((0x551d0f0000000000000000000000000000000000000000000000000000000000))
            ) break; // OID for the AKID
        }
        require(i < tlvs.length, 'OID for Key Usage not found');
        bytes memory usageBytes = tlvs[i + 1].value;
        DecodedTlv[] memory usageTlvs = new DecodedTlv[](1);
        usageTlvs = this.parseDER(usageBytes, 0, 1);
        require(usageTlvs[0].length == 2, 'Key usage bytes must be of 2 bytes');
        // decoding of flags encoded as DER is strange. The first byte tells us how many bits to ignore in the second byte
        bytes1 usageFlags = (usageTlvs[0].value[1] >> uint8(usageTlvs[0].value[0])) <<
            uint8(usageTlvs[0].value[0]);
        // this is little endian and so must our mask be therefore
        require((usageFlags & _usageBitMask) == _usageBitMask, 'Key usage is not as required');
    }

    // function to check the signature over a message
    function checkSignature(
        bytes memory signature,
        bytes memory message,
        RSAPublicKey memory publicKey
    ) private view {
        bytes memory signatureDecrypt = modExp(signature, publicKey.exponent, publicKey.modulus);
        bytes memory messageHashFromSignature = validateSignatureAndExtractMessageHash(
            signatureDecrypt,
            5
        );
        // we use the keccak hash here as a low cost way to check equality of bytes data
        require(
            keccak256(messageHashFromSignature) == keccak256(abi.encode(sha256(message))),
            'Signature is invalid'
        );
    }

    /**
    This function is the main one in the module. It calls all of the subsidiary functions necessary to validate an RSA cert
    If the validation is successful (and addAddress is true), it will add the sender to the whitelist contract, provided they
    are able to sign their ethereum address with the private key corresponding to the certificate.
     */
    function validateCertificate(
        bytes calldata certificate,
        uint256 tlvLength,
        bytes calldata addressSignature,
        bool addAddress
    ) external {
        DecodedTlv[] memory tlvs = new DecodedTlv[](tlvLength);
        // decode the DER encoded binary certificate data into an array of Tag-Length-Value structs
        tlvs = walkDerTree(certificate, 0, tlvLength);
        // extract the data from the certificate necessary for checking the signature and (hopefully) find the Authority public key in
        // the smart contract's list of trusted keys
        bytes32 authorityKeyIdentifier = extractAuthorityKeyIdentifier(tlvs);
        bytes memory signature = getSignature(tlvs, tlvLength);
        bytes memory message = getMessage(tlvs);
        RSAPublicKey memory publicKey = trustedPublicKeys[authorityKeyIdentifier];
        // validate the cert's signature and check that the cert is in date, record the expiry date against msg.sender
        checkSignature(signature, message, publicKey);
        uint256 expiry = checkDates(tlvs);
        // The certificate is valid and linked to a root we trust, so now we trust the certificate's public key too. Let's add it to our list of trusted keys
        RSAPublicKey memory certificatePublicKey = extractPublicKey(tlvs);
        bytes32 subjectKeyIdentifier = extractSubjectKeyIdentifier(tlvs);
        require(!revokedKeys[subjectKeyIdentifier], 'The key of this certificate has been revoked');
        // finally, before we can whitelist msg.sender, we should check that they are indeed the owner of the cert (certs are public, after all)
        // we do that by getting them to sign msg.sender with the private key corresponding to their certificate public key
        if (!addAddress) {
            // if we're not adding an address, check that this certificate can sign certificates (because it must be an intermediate one)
            checkKeyUsage(tlvs, 0x06);
            // if yes, we'll trust it
            trustedPublicKeys[subjectKeyIdentifier] = certificatePublicKey;
            return; // we may want to add an intermediate cert to the contract but not add an address.
        }
        // as we are trying to add an address, this certificate should be an end user certificate, created for digital signature
        // and non-repudiation (or possibly other things - we can change this).
        checkKeyUsage(tlvs, usageBitMask);
        trustedPublicKeys[subjectKeyIdentifier] = certificatePublicKey;
        checkSignature(
            addressSignature,
            abi.encodePacked(uint160(msg.sender)),
            certificatePublicKey
        );
        expires[msg.sender] = expiry;
        keysByUser[msg.sender] = subjectKeyIdentifier;
        addUserToWhitelist(msg.sender); // all checks have passed, so they are free to trade for now.
    }

    // performs an ongoing KYC check (is the user still in the whitelist? Has the public key been revoked? Is the cert in date?)
    // We could also remove the user in this function, but that would burn more gas.
    function kycCheck(address user) external view returns (bool) {
        if (
            !whitelisting ||
            (!revokedKeys[keysByUser[user]] &&
                expires[user] > block.timestamp &&
                isWhitelisted(user))
        ) return true;
        return false;
    }

    // allows a key to be revoked. this cannot be undone!
    function revokeKey(bytes32 subjectKeyIdentifier) external {
        require(
            keysByUser[msg.sender] == subjectKeyIdentifier,
            'You are not the owner of this key'
        );
        revokedKeys[subjectKeyIdentifier] = true;
    }
}
