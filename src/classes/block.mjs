/**
An optimistic layer 2 Block class
*/
import config from 'config';
import { getSiblingPath } from '../utils/timber.mjs';
import mt from '../utils/crypto/merkle-tree/merkle-tree.mjs';

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

  #currentLeafCount;

  #transactions;

  transactionHashes;

  proposer;

  blockTime = 0; // null value as explained above

  blockHash = config.ZERO; // null value as explained above

  constructor(asyncParams) {
    if (asyncParams === undefined) throw new Error('Cannot be called directly');
    const { proposer, transactions, currentLeafCount, root } = asyncParams;
    this.#currentLeafCount = currentLeafCount;
    this.proposer = proposer;
    this.#transactions = transactions;
    this.transactionHashes = this.#transactions.map(transaction => transaction.transactionHash);
    this.root = root;
  }

  // computes the root. We use a Builder pattern because it's very bad form to
  // return a promise from a constructor (is it even possible?)- which should
  // return a fully-formed object, also, we're too cool for an init() function.
  static async build({ proposer, transactions, currentLeafCount }) {
    const frontier = await getSiblingPath(currentLeafCount);
    // extract the commitment hashes from the transactions
    const leafValues = transactions.map(transaction => transaction.commitments).flat(Infinity);
    console.log('LEAF VALUES', leafValues);
    const { root } = await updateNodes(leafValues, currentLeafCount, frontier);
    return new Block({ proposer, transactions, currentLeafCount, root });
  }
}

export default Block;
