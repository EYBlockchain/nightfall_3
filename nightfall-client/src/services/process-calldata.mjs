/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from '../utils/web3.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

const { PROPOSE_BLOCK_TYPES, STATE_CONTRACT_NAME, ZERO } = config;

function calcBlockHash(block, transactions) {
  const web3 = Web3.connection();
  const { proposer, root, leafCount } = block;
  const blockArray = [leafCount, proposer, root];
  const transactionsArray = transactions.map(t => {
    const {
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof,
    } = t;
    return [
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof, // note - this is not compressed here
    ];
  });
  const encoded = web3.eth.abi.encodeParameters(PROPOSE_BLOCK_TYPES, [
    blockArray,
    transactionsArray,
  ]);
  return web3.utils.soliditySha3({ t: 'bytes', v: encoded });
}

async function getProposeBlockCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.eth.abi.decodeParameters(PROPOSE_BLOCK_TYPES, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [leafCount, proposer, root] = blockData;
  const block = {
    proposer,
    root,
    leafCount: Number(leafCount),
  };
  const transactions = transactionsData.map(t => {
    const [
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof,
    ] = t;
    const transaction = {
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof, // note - this is not decompressed here
    };
    // note, this transaction is incomplete in that the 'fee' field is empty.
    // that shouldn't matter as it's not needed.
    return transaction;
  });
  // Client is only really interested in the nullifiers that have been added
  // because it needs to know if a commitment has been spent or not. Neither
  // Optimist or Timber can know this as we don't want them dealing with
  // zkp private keys.
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  const nullifiers = transactions
    .map(t => t.nullifiers)
    .flat()
    .filter(n => n !== ZERO);
  // next, we need to tie these up with the number of the block that they are in
  // It's a little non-trivial to compute this because of course the on-chain
  // layer 2 block record may have moved on since we arrived here if other
  // proposeBlocks have happened, firing off other handler asyncs.
  // To make sure we get the correct block number, we'll start from the end of
  // the blockchain record and search backwards until we find 'our' L2 block.
  // Unless we've spent ages here, it'll be close to the end.
  const blockHash = calcBlockHash(block, transactions);
  let blockNumberL2 = Number(await stateContractInstance.methods.getNumberOfL2Blocks().call());
  do {
    blockNumberL2--;
    if (blockNumberL2 < 0)
      throw new Error(
        'The begining of the Layer 2 record has been reached and the block was not found',
      );
  } while (
    // we don't want to spawn loads of asyncs because we probably only need to
    // go a few times round this loop before finding 'our' block
    // eslint-disable-next-line no-await-in-loop
    blockHash !== (await stateContractInstance.methods.getBlockData(blockNumberL2).call()).blockHash
  );
  return { nullifiers, blockNumberL2 };
}

export default getProposeBlockCalldata;
