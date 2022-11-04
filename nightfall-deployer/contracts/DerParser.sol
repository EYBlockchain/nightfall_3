// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.3;

// This contract can parse a DER object, such as a suitably encoded SSL certificate
import 'hardhat/console.sol';

contract DERParser {
    struct DecodedTlv {
        uint256 start;
        uint256 headerLength;
        Tag tag;
        uint256 length;
        bytes value;
        bytes octets;
        uint256 depth;
    }
    struct Tag {
        bool isConstructed;
        bytes1 tagType;
    }

    uint256 constant MAX_DEPTH = 5;

    /*
  Parses the input tag.
  */
    function getTlvTag(bytes1 tagByte, uint256 pointer)
        private
        pure
        returns (
            Tag memory,
            uint256,
            uint256
        )
    {
        bytes1 tagClass = tagByte & 0xC0;
        bool isConstructed = (tagByte & 0x20) != 0;
        bytes1 tagType = tagByte & 0x1F;
        uint256 headerLength = 0;
        require(tagType < 0x1F, 'Tag is Long Form, which is not supported');
        require(
            tagClass == 0 || tagClass == 0x80,
            'Only the Universal or ContextSpecific tag classes are supported'
        );
        headerLength++;
        return (Tag(isConstructed, tagType), ++pointer, headerLength);
    }

    /*
  Parses the length bytes, which must be at the start of the passed-in bytes
  */
    function getTlvLength(
        bytes calldata derSlice,
        uint256 pointer,
        uint256 headerLength
    )
        private
        pure
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        headerLength++;
        bool shortForm = (derSlice[0] & 0x80) == 0;
        uint256 lengthBits = uint256(uint8(derSlice[0] & 0x7F)); // this contains either the length value (shortform) or the number of following octets that contain the length value (long form)
        if (shortForm) return (lengthBits, ++pointer, headerLength); //it's a short form length, so we're done
        // it's not short form so more work to do
        require(lengthBits != 0, 'Indefinite lengths are not supported');
        require(lengthBits != 0x7F, 'A value of 0x7F for a long form length is a reserved value');
        uint256 length = 0;
        for (uint256 i = 0; i < lengthBits; i++) {
            length = (length << 8) | uint256(uint8(derSlice[i + 1]));
        }
        return (length, pointer + lengthBits + 1, headerLength + lengthBits);
    }

    /*
  Returns the value field for the tlv encoded data.  The passed in bytes must have the value field starting at byte[0]
  */
    function getTlvValue(
        bytes calldata derSlice,
        uint256 length,
        uint256 pointer,
        Tag memory tag
    ) private pure returns (bytes memory, uint256) {
        if (tag.isConstructed) return (derSlice[:length], pointer); // we want to point at the start of the value because it contains child tlv constructs so we need to process it further
        return (derSlice[:length], pointer + length); //these '1' values should be length - DEBUG
    }

    /*
  Assembles the next tlv element from an array of bytes representing DER encoded data.  The next element must be at the start of the DER bytes array
  */
    function getNextTlv(
        bytes calldata derSlice,
        uint256 pointer,
        uint256 depth
    ) internal pure returns (DecodedTlv memory, uint256) {
        Tag memory tag;
        uint256 length;
        bytes memory value;
        uint256 headerLength;
        uint256 start = pointer;
        (tag, pointer, headerLength) = getTlvTag(derSlice[pointer], pointer);
        (length, pointer, headerLength) = getTlvLength(derSlice[pointer:], pointer, headerLength);
        (value, pointer) = getTlvValue(derSlice[pointer:], length, pointer, tag);
        bytes memory octets = derSlice[start:start + headerLength + length];
        DecodedTlv memory tlv = DecodedTlv(start, headerLength, tag, length, value, octets, depth);
        return (tlv, pointer);
    }

    /**
  A function that walks through the ASN.1 tree that the DER bytes encode
  @param derBytes the DER encoded certificate (although this should work with any ASN.1 DER encoded binary object)
  @param pointer the place inthe DER bytes to start the decode from (usually zero)
  */
    function walkDerTree(
        bytes calldata derBytes,
        uint256 pointer,
        uint256 tlvLength
    ) internal pure returns (DecodedTlv[] memory) {
        DecodedTlv memory tlv;
        DecodedTlv[] memory tlvs = new DecodedTlv[](tlvLength);
        uint256 depth = 0;
        uint256 id = 0;
        uint256[MAX_DEPTH] memory depthChangesAt;
        do {
            (tlv, pointer) = getNextTlv(derBytes, pointer, depth);
            tlvs[id++] = tlv;
            if (tlv.tag.isConstructed) {
                depthChangesAt[depth] = pointer + tlv.length;
                depth++;
            }
            for (uint256 i = 0; i < MAX_DEPTH; i++) {
                if (pointer == depthChangesAt[i]) depth--;
            }
        } while (pointer < derBytes.length);
        return (tlvs);
    }

    /*
    This function is like walkDerTree but it doesn't store any tlvs. It can be used without gas cost
    To compute the length of the tlv array (we could make a nodejs version of this in the future)
    */
    function computeNumberOfTlvs(bytes calldata derBytes, uint256 pointer)
        external
        pure
        returns (uint256)
    {
        DecodedTlv memory tlv;
        uint256 depth = 0;
        uint256 id = 0;
        uint256[MAX_DEPTH] memory depthChangesAt;
        do {
            (tlv, pointer) = getNextTlv(derBytes, pointer, depth);
            id++;
            if (tlv.tag.isConstructed) {
                depthChangesAt[depth] = pointer + tlv.length;
                depth++;
            }
            for (uint256 i = 0; i < MAX_DEPTH; i++) {
                if (pointer == depthChangesAt[i]) depth--;
            }
        } while (pointer < derBytes.length);
        return id;
    }

    /*
  Parses the bytes DER encoded data and extracts the (possibly nested) TLV elements
  as 'DecodedTlv[]'.
  */
    function parseDER(
        bytes calldata derBytes,
        uint256 pointer,
        uint256 tlvLength
    ) external pure returns (DecodedTlv[] memory) {
        return walkDerTree(derBytes, pointer, tlvLength);
    }
}
