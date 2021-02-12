/**
An optimistic layer 2 Block class
*/
import { getFrontier } from '../utils/timber.mjs';
import mt from '../utils/crypto/merkle-tree/merkle-tree.mjs';
import Web3 from '../utils/web3.mjs';

const { updateNodes } = mt;

/**
This Block class does not have the Block components that are computed on-chain.
A Block struct in Solidity also has a blockTime and a blockHash. The
blocktime is computed on-chain at the point of Block submission, and is
part of the preimage of the blockHash, thus we cannot compute either of
these properties offchain.
*/
class Block {
  root; // remembers the root of this block to save recomputing it

  leafCount;

  transactionHashes;

  proposer;

  hash;

  blockHash; // null value as explained above

  constructor(asyncParams) {
    if (asyncParams === undefined) throw new Error('Cannot be called directly');
    const { proposer, transactionHashes, leafCount, root, blockHash } = asyncParams;
    this.leafCount = leafCount;
    this.proposer = proposer;
    this.transactionHashes = transactionHashes;
    this.root = root;
    this.blockHash = blockHash;
  }

  // computes the root and hash. We use a Builder pattern because it's very
  // bad form to return a promise from a constructor -
  // which should return a fully-formed object. Also, we're too cool for an
  // init() function.
  static async build({ proposer, transactions, currentLeafCount }) {
    const web3 = Web3.connection();
    // we have to get the current frontier from Timber, so that we can compute
    // the new root bearing in mind that the transactions in this block won't
    // be in Timber yet.  However, Timber has a handy update
    // interface, which will, inter-alia, return that very frontier.
    const frontier = await getFrontier();
    // extract the commitment hashes from the transactions
    const leafValues = transactions.map(transaction => transaction.commitments).flat(Infinity);
    // compute the root using Timber's code
    const { root } = await updateNodes(leafValues, currentLeafCount, frontier);
    const leafCount = currentLeafCount || 0;
    // compute the keccak hash of the block data
    const transactionHashes = transactions.map(transaction => transaction.transactionHash);
    const blockHash = web3.utils.soliditySha3(
      { t: 'address', v: proposer },
      ...transactionHashes.map(th => ({ t: 'bytes32', v: th })),
      { t: 'bytes32', v: root },
      { t: 'uint', v: leafCount },
    );
    return new Block({ proposer, transactionHashes, leafCount, root, blockHash });
  }

  static checkHash(block) {
    const web3 = Web3.connection();
    const blockHash = web3.utils.soliditySha3(
      { t: 'address', v: block.proposer },
      ...block.transactionHashes.map(th => ({ t: 'bytes32', v: th })),
      { t: 'bytes32', v: block.root },
      { t: 'uint', v: block.leafCount },
    );
    return blockHash === block.blockHash;
  }
}

export default Block;
