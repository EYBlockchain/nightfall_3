// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

// This contract can parse  a suitably encoded SSL certificate
import './DerParser.sol';
import './Ownable.sol';

contract X509 is DERParser, Ownable {
    struct RSAPublicKey {
        bytes modulus;
        uint256 exponent;
    }
    mapping(bytes32 => RSAPublicKey) trustedPublicKeys;
    bool public isValid = false; // used for testing gas

    function initialize() public override initializer {
        Ownable.initialize();
    }

    function setTrustedPublicKey(
        RSAPublicKey calldata trustedPublicKey,
        bytes32 authorityKeyIdentifier
    ) external onlyOwner {
        //TODO some validation here
        trustedPublicKeys[authorityKeyIdentifier] = trustedPublicKey;
    }

    function getSignature(DecodedTlv[MAX_TLVS] memory tlvs, uint256 maxId)
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

    function getMessage(DecodedTlv[MAX_TLVS] memory tlvs) private pure returns (bytes memory) {
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
    function validateAndExtractPayload(bytes memory decrypt)
        private
        view
        returns (DecodedTlv[MAX_TLVS] memory)
    {
        DecodedTlv[MAX_TLVS] memory tlvs;
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
        (tlvs, ) = this.parseDER(decrypt, i);
        return tlvs;
    }

    function validateCertificate(bytes calldata certificate, bytes32 authorityKeyIdentifier)
        external
        returns (DecodedTlv[MAX_TLVS] memory)
    {
        DecodedTlv[MAX_TLVS] memory tlvs;
        uint256 maxId;
        (tlvs, maxId) = walkDerTree(certificate, 0);
        bytes memory signature = getSignature(tlvs, maxId);
        bytes memory message = getMessage(tlvs);
        RSAPublicKey memory publicKey = trustedPublicKeys[authorityKeyIdentifier];
        bytes memory signatureDecrypt = modExp(signature, publicKey.exponent, publicKey.modulus);
        DecodedTlv[MAX_TLVS] memory payload = validateAndExtractPayload(signatureDecrypt);
        require(
            payload[4].depth == 1 && payload[4].tag.tagType == 0x04,
            'Incorrect tag or position for decrypted hash data'
        );
        bytes memory messageHashFromSignature = payload[4].value;
        // we use the keccak hash here as a low cost way to check equality of bytes data
        require(
            keccak256(messageHashFromSignature) == keccak256(abi.encode(sha256(message))),
            'Signature is invalid'
        );
        isValid = true;
        return payload;
    }

    // test function, for modExp
    function testModExp(
        bytes memory b,
        uint256 e,
        bytes memory m
    ) external view returns (bytes memory) {
        return modExp(b, e, m);
    }
}
