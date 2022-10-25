const derMapping = [
  'End_of_Content',
  'BOOLEAN',
  'INTEGER',
  'BIT_STRING',
  'OCTET_STRING',
  'NULL',
  'OBJECT_IDENTIFIER',
  'Object_Descriptor',
  'EXTERNAL',
  'REAL',
  'ENUMERATED',
  'EMBEDDED_PDV',
  'UTF8String',
  'RELATIVE_OID',
  'TIME',
  'Reserved',
  'SEQUENCE',
  'SET',
  'NumericString',
  'PrintableString',
  'T61String',
  'VideotexString',
  'IA5String',
  'UTCTime',
  'GeneralizedTime',
  'GraphicString',
  'VisibleString',
  'GeneralString',
  'UniversalString',
  'CHARACTER_STRING',
  'BMPString',
  'DATE',
  'TIME_OF_DAY',
  'DATE_TIME',
  'DURATION',
  '[OID_IRI',
  'RELATIVE_OID_IRI',
];

/*
Function to take an Ethers 'representation' of a Solidity Decoded TLV struct and turn it into a
well-structured TLV object
*/

function makeTlv(struct) {
  const { id: _id, tag: _tag, _length, value, depth: _depth } = struct;
  const { isConstructed, tagType } = _tag;
  const tlv = {
    id: _id.toNumber(),
    tag: { isConstructed, tagType: derMapping[parseInt(tagType, 16)] },
    length: _length.toNumber(),
    value,
    depth: _depth.toNumber(),
  };
  return tlv;
}

export default makeTlv;
