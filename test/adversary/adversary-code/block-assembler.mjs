/* eslint-disable no-undef */
let unsignedProposeBlockTransaction = await (
  await waitForContract(STATE_CONTRACT_NAME)
).methods
  .proposeBlock(
    Block.buildSolidityStruct(block),
    transactions.map(t => Transaction.buildSolidityStruct(t)),
  )
  .encodeABI();

if (badBlockType === 'IncorrectLeafCount') {
  const badLeafCount = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(4)
    .slice(2);
  unsignedProposeBlockTransaction =
    unsignedProposeBlockTransaction.substring(0, 10) +
    badLeafCount +
    unsignedProposeBlockTransaction.substring(18);
} else if (badBlockType === 'IncorrectTreeRoot') {
  const badRoot = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(32)
    .slice(2);
  unsignedProposeBlockTransaction =
    unsignedProposeBlockTransaction.substring(0, 74) +
    badRoot +
    unsignedProposeBlockTransaction.substring(138);
} else if (badBlockType === 'IncorrectFrontierHash') {
  const badFrontier = generalise(Math.floor(Math.random() * 2 ** 16))
    .hex(32)
    .slice(2);
  // eslint-disable-next-line no-unused-vars
  unsignedProposeBlockTransaction =
    unsignedProposeBlockTransaction.substring(0, 202) +
    badFrontier +
    unsignedProposeBlockTransaction.substring(266);
}

badBlockType = '';
