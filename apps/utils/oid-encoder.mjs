/**
 * A small application that can encode an ASN1 Object Identifier (OID) into a format
 * suitable for use by X509.sol, which expects OIDs to be encoded into bytes32
 */

const oid = process.argv[2];
const oidArray = oid.split('.').map(o => parseInt(o, 10));
// the first two numbers are encoded into a single byte
const oidBytes = [];
oidBytes.push(oidArray[0] * 40 + oidArray[1], ...oidArray.slice(2));
const oidBuffer = Buffer.from(oidBytes);
const bytes32 = `0x${oidBuffer.toString('hex').padEnd(64, '0')}`;
console.log(bytes32);
