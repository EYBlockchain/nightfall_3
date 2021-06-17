/**
Module that processes new block headers
*/

import blockProposedHandler from './block-proposed.mjs';

async function newBlockHeaderHandler(blockHeader, web3) {
  // encode any signatures that we're going to need TODO hardcode this.
  const blockProposed = '0xd568c6b8'; // function signature for proposeBlock. TODO move to config.
  // recover the block data
  const block = await web3.eth.getBlock(blockHeader.number, true);
  const { transactions } = block;
  // go through each transaction in the block and process it if we need to
  transactions.forEach(async tx => {
    const functionId = `${tx.input.slice(0, 10)}`;
    const receipt = await web3.eth.getTransactionReceipt(tx.hash);
    // we don't really use the switch case - it's for future expansion
    switch (functionId) {
      case blockProposed:
        if (receipt.status) blockProposedHandler(tx);
        break;
      default:
    }
  });
}

export default newBlockHeaderHandler;
