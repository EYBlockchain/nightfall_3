// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

// This contract can parse a DER object, such as a suitably encoded SSL certificate
import "hardhat/console.sol";

contract DERParser {
  struct DecodedTlv {
    uint id;
    Tag tag;
    uint length;
    bytes value;
    uint depth;
  }
  struct Tag {
    bool isConstructed;
    bytes1 tagType;
  }

  uint constant MAX_DEPTH = 5;
  uint constant MAX_TLVS = 75;

  uint public state;

  /*
  Parses the input tag.
  */
  function getTlvTag(bytes1 tagByte, uint pointer) private pure returns(Tag memory, uint) {
    bytes1 tagClass = tagByte & 0xC0;
    bool isConstructed = (tagByte & 0x20) != 0;
    bytes1 tagType = tagByte & 0x1F;
    require(tagType < 0x1F, 'Tag is Long Form, which is not supported');
    require(tagClass == 0 || tagClass == 0x80, 'Only the Universal or ContextSpecific tag classes are supported');
    return (Tag(isConstructed, tagType), ++pointer);
  }
  /*
  Parses the length bytes, which must be at the start of the passed-in bytes
  */
  function getTlvLength(bytes calldata derSlice, uint pointer) private pure returns(uint, uint) {
    bool shortForm = (derSlice[0] & 0x80) == 0;
    uint lengthBits = uint(uint8(derSlice[0] & 0x7F)); // this contains either the length value (shortform) or the number of following bytes that contain the length value (long form)
    if (shortForm) return (lengthBits, ++pointer); //it's a short form length, so we're done
    // it's not short form so more work to do
    require (lengthBits != 0, 'Indefinite lengths are not supported');
    require (lengthBits != 0x7F, 'A value of 0x7F for a long form length is a reserved value');
    uint length = 0;
    for (uint i = 0; i < lengthBits; i++) {
      length = (length << 8) | uint(uint8(derSlice[i+1]));
    }
    return (length, pointer + lengthBits + 1);
  }
  /*
  Returns the value field for the tlv encoded data.  The passed in bytes must have the value field starting at byte[0]
  */
  function getTlvValue(bytes calldata derSlice, uint length, uint pointer, Tag memory tag) private pure returns(bytes memory, uint) {
    if (tag.isConstructed) return (derSlice[:length], pointer); // we want to point at the start of the value because it contains child tlv constructs so we need to process it further
    return (derSlice[:length], pointer + length); //these '1' values should be length - DEBUG
  }
  /*
  Assembles the next tlv element from an array of bytes representing DER encoded data.  The next element must be at the start of the DER bytes array
  */
  function getNextTlv(bytes calldata derSlice, uint pointer, uint depth, uint id) private pure returns(DecodedTlv memory, uint) {
    Tag memory tag;
    uint length;
    bytes memory value;
    (tag, pointer) = getTlvTag(derSlice[pointer], pointer);
    (length, pointer) = getTlvLength(derSlice[pointer:], pointer);
    (value, pointer) = getTlvValue(derSlice[pointer:], length, pointer, tag);
    DecodedTlv memory tlv = DecodedTlv(id, tag, length, value, depth );
    return (tlv, pointer);
  }

  /**
  A function that walks through the ASN.1 tree that the DER bytes encode
  @param derBytes the DER encoded certificate (although this should work with any ASN.1 DER encoded binary object)
  */
  function walkDerTree(bytes calldata derBytes) private pure returns(DecodedTlv[MAX_TLVS] memory) {
    DecodedTlv memory tlv;
    DecodedTlv[MAX_TLVS] memory tlvs;
    uint pointer = 0;
    uint  depth = 0;
    uint id = 0;
    uint[MAX_DEPTH] memory depthChangesAt;
    do {
      (tlv, pointer) = getNextTlv(derBytes, pointer, depth, id++);
      tlvs[id] = tlv;
      if (tlv.tag.isConstructed) {
        depthChangesAt[depth] = pointer + tlv.length;
        depth++;
      }
      for (uint i = 0; i < MAX_DEPTH; i++ ) {
        if (pointer == depthChangesAt[i]) depth--;
      }
    } while (pointer < derBytes.length);
    return tlvs;
  }
  /*
  Parses the bytes DER encoded data and extracts the (possibly nested) TLV elements
  as 'DecodedTlv[]'.
  */
  function parseDER(bytes calldata derBytes) external pure returns(DecodedTlv[MAX_TLVS] memory) {
      return walkDerTree(derBytes);
  }

  /*
  state-changing function to test cost of compute of the pure functions above
  */
  function store(bytes calldata derBytes) external {
    state = walkDerTree(derBytes)[0].id;
  }
}