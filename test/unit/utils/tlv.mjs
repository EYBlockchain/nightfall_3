/*
Function to take an Ethers 'representation' of a Solidity Decoded TLV struct and turn it into a
well-structured TLV object
*/

function makeTlv(struct) {
  const { id: _id, tag: _tag, _length, value, depth: _depth } = struct;
  const { isConstructed, tagType } = _tag;
  const tlv = {
    id: _id.toNumber(),
    tag: { isConstructed, tagType },
    length: _length.toNumber(),
    value,
    depth: _depth.toNumber(),
  };
  return tlv;
}

export default makeTlv;
