// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

// This contract can parse  a suitably encoded SSL certificate
import './DerParser.sol';
import './Ownable.sol';

contract X509 is DERParser, Ownable {
    uint256 constant SECONDS_PER_DAY = 24 * 60 * 60;
    int256 constant OFFSET19700101 = 2440588;

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
    function validateAndExtractPayload(bytes memory decrypt, uint256 tlvLength)
        private
        view
        returns (DecodedTlv[] memory)
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
        return tlvs;
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
    function checkDates(DecodedTlv[] memory tlvs) private view {
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
        require(
            block.timestamp < timestampFromDate(tlvs[i + 2].value),
            'This certificate has expired'
        );
    }

    function validateCertificate(
        bytes calldata certificate,
        bytes32 authorityKeyIdentifier,
        uint256 tlvLength
    ) external {
        DecodedTlv[] memory tlvs = new DecodedTlv[](tlvLength);
        tlvs = walkDerTree(certificate, 0, tlvLength);
        bytes memory signature = getSignature(tlvs, tlvLength);
        bytes memory message = getMessage(tlvs);
        RSAPublicKey memory publicKey = trustedPublicKeys[authorityKeyIdentifier];
        bytes memory signatureDecrypt = modExp(signature, publicKey.exponent, publicKey.modulus);
        DecodedTlv[] memory payload = validateAndExtractPayload(signatureDecrypt, 5);
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
        checkDates(tlvs);
        isValid = true;
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
