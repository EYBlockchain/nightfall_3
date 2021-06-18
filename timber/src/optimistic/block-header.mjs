/**
Module that processes new block headers
*/

async function newBlockHeaderHandler(blockHeader, web3, args) {
  // recover the block data
  const block = await web3.eth.getBlock(blockHeader.number, true);
  const { transactions } = block;
  const { functionSignatures, functionCallHandlers, newEventResponder } = args[0];
  const functionNames = Object.keys(functionSignatures);
  // go through each transaction in the block and process it if we need to
  transactions.forEach(async tx => {
    const functionSignature = `${tx.input.slice(0, 10)}`;
    const receipt = web3.eth.getTransactionReceipt(tx.hash);
    // for each transaction, check against the list of functions we want handled
    functionNames.forEach(async fn => {
      if (functionSignature === functionSignatures[fn] && (await receipt).status)
        newEventResponder(tx, functionCallHandlers[fn], args);
    });
  });
}
export default newBlockHeaderHandler;
