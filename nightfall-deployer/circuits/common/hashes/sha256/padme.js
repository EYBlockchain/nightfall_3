/**
@author Westlad
A small utility to calculate sha padding.  This is often needed in a .zok file
and it's a bit of a pain to look up the NIST standard and manually compute it
each time

THIS VERSION IS FOR USE WITH THE NEW ZOKRATES U32 TYPE

To execute from command line:
$ node path/to/padme.js -l <message length>
*/
// Disabling because this will only be used by devs.
// eslint-disable-next-line import/no-extraneous-dependencies
const yargs = require('yargs');

const options = yargs.option('l', {
  alias: 'message-length',
  describe: 'the length of the message to be padded in bits',
  type: 'number',
  demandOption: true,
}).argv;

const { l } = options;
let padding = [];
padding.push('1');
const k = (((448 - l - 1) % 512) + 512) % 512; // this gives a true mod rather than a remainder
padding = padding.concat(new Array(k).fill('0'));
padding = padding.concat(BigInt(l).toString(2).padStart(64, '0').split(''));
// now convert the padding to hex and split it up into U32s
for (let i = 0; i < padding.length; i += 32) {
  const wordBin = padding.slice(i, i + 32).join('');
  const wordHex = BigInt(`0b${wordBin}`).toString(16);
  console.log(`0x${wordHex.padStart(8, '0')},`);
}
console.log('Padding length is', padding.length, `u32[${padding.length / 32}]`);
console.log(
  'Padded length (hash needed) is',
  l + padding.length,
  `u32[${(l + padding.length) / 32}]`,
);
console.log('Message length,', l, `is u32[${l / 32}]`);
// console.log('The padding that you are looking for is:', padding.join(',  '));
