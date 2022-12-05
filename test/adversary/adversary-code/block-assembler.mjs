/* eslint-disable no-undef */
let txDataToSign = await stateContractInstance.methods
  .proposeBlock(
    Block.buildSolidityStruct(block),
    transactions.map(t => Transaction.buildSolidityStruct(t)),
  )
  .encodeABI();

if (badBlockType === 'IncorrectLeafCount') {
  const badLeafCount = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(4)
    .slice(2);
  txDataToSign = txDataToSign.substring(0, 10) + badLeafCount + txDataToSign.substring(18);
} else if (badBlockType === 'IncorrectTreeRoot') {
  const badRoot = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(32)
    .slice(2);
  txDataToSign = txDataToSign.substring(0, 74) + badRoot + txDataToSign.substring(138);
} else if (badBlockType === 'IncorrectFrontierHash') {
  const badFrontier = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(32)
    .slice(2);
  // eslint-disable-next-line no-unused-vars
  txDataToSign = txDataToSign.substring(0, 202) + badFrontier + txDataToSign.substring(266);
}

badBlockType = '';
