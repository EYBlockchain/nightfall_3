/**
An optimistic layer 2 Block class
*/
import config from 'config';
import Timber from 'common-files/classes/timber.mjs';
import constants from 'common-files/constants/index.mjs';
import {
  getLatestBlockInfo,
  getTreeByBlockNumberL2,
  setTransactionHashSiblingInfo,
} from '../services/database.mjs';
import {
  buildBlockSolidityStruct,
  calcBlockHash,
  calculateFrontierHash,
} from '../services/block-utils.mjs';

const { TIMBER_HEIGHT, HASH_TYPE, TXHASH_TREE_HASH_TYPE } = config;
const { ZERO } = constants;

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

  transactionHashesRoot;

  proposer;

  blockHash; // null value as explained above

  nCommitments; // number of commitments in the block

  blockNumberL2; // the number (index) of this Layer 2 block

  previousBlockHash; // the block hash of the previous block (for re-assembling the chain after a reorg)

  frontierHash;

  static localLeafCount = 0; // ensure this is less than Timber to start with

  static localBlockNumberL2 = 0;

  static localFrontier = [];

  static localRoot = 0;

  static localPreviousBlockHash = ZERO;

  constructor(asyncParams) {
    if (asyncParams === undefined) throw new Error('Cannot be called directly');
    const {
      proposer,
      transactionHashes,
      transactionHashesRoot,
      leafCount,
      root,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
      frontierHash,
    } = asyncParams;
    this.leafCount = leafCount;
    this.proposer = proposer;
    this.transactionHashes = transactionHashes;
    this.transactionHashesRoot = transactionHashesRoot;
    this.root = root;
    this.blockHash = blockHash;
    this.nCommitments = nCommitments;
    this.blockNumberL2 = blockNumberL2;
    this.previousBlockHash = previousBlockHash;
    this.frontierHash = frontierHash;
  }

  // computes the root and hash. We use a Builder pattern because it's very
  // bad form to return a promise from a constructor -
  // which should return a fully-formed object. Also, we're too cool for an
  // init() function.
  static async build(components) {
    const { proposer, transactions } = components;
    // This is blockNumberL2 and blockHash of the last block we have.
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1; // We increment it as this is what the next block should be
    let previousBlockHash = dbBlockHash;
    // It's possible that the previously made block hasn't been added to the blockchain yet.
    // In that case, this block will have the same block number as the previous block
    // and will rightly be reverted when we attempt to add it to the chain.
    // Thus, we use our locally stored values to make the new block, updating these local values
    // only if the on-chain value is ahead of our local value.
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      // Make blocks with our on-chain values.
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getTreeByBlockNumberL2(blockNumberL2 - 1);
    } else {
      // Make blocks with our local values.
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(
        this.localRoot,
        this.localFrontier,
        this.localLeafCount,
        undefined,
        HASH_TYPE,
        TIMBER_HEIGHT,
      );
    }
    // extract the commitment hashes from the transactions
    // we filter out zeroes commitments that can come from withdrawals
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;

    // Stateless update our frontier and root
    const updatedTimber = Timber.statelessUpdate(timber, leafValues, HASH_TYPE, TIMBER_HEIGHT);
    // remember the updated values in case we need them for the next block.
    this.localLeafCount = updatedTimber.leafCount;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
    // compute the keccak hash of the proposeBlock signature
    const blockHash = this.calcHash({
      proposer,
      root: updatedTimber.root,
      leafCount: updatedTimber.leafCount,
      blockNumberL2,
      previousBlockHash,
      transactionHashesRoot: await this.calcTransactionHashesRoot(transactions),
      frontierHash: this.calcFrontierHash(updatedTimber.frontier),
    });
    this.localPreviousBlockHash = blockHash;
    // note that the transactionHashes array is not part of the on-chain block
    // but we compute it here for convenience. It needs removing before sending
    // a block object to the blockchain.
    return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      transactionHashesRoot: await this.calcTransactionHashesRoot(transactions),
      leafCount: updatedTimber.leafCount,
      root: updatedTimber.root,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
      frontierHash: this.calcFrontierHash(updatedTimber.frontier),
    });
  }

  // we cache the leafCount in case Timber isn't up to date, however we
  // need to reset the cache in the event of a rollback or we'll make a block
  // with the wrong leafCount. The same applies to the localBlockNumberL2 and
  // root.
  static rollback() {
    this.localLeafCount = 0;
    this.localBlockNumberL2 = 0;
    this.localRoot = 0;
    this.localPreviousBlockHash = ZERO;
  }

  static checkHash(block) {
    return this.calcHash(block) === block.blockHash;
  }

  static async calcTransactionHashesRoot(transactions) {
    const transactionHashes = transactions.map(t => t.transactionHash);
    let height = 1;
    while (2 ** height < transactionHashes.length) {
      ++height;
    }

    const timber = new Timber(...[, , , ,], TXHASH_TREE_HASH_TYPE, height);
    const updatedTimber = Timber.statelessUpdate(
      timber,
      transactionHashes,
      TXHASH_TREE_HASH_TYPE,
      height,
    );

    await Promise.all(
      // eslint-disable-next-line consistent-return
      transactionHashes.map(async (t, i) => {
        const siblingPath = Timber.statelessSiblingPath(
          timber,
          transactionHashes,
          i,
          TXHASH_TREE_HASH_TYPE,
          height,
        );
        return setTransactionHashSiblingInfo(
          t,
          siblingPath,
          timber.leafCount + i,
          updatedTimber.root,
        );
      }),
    );

    return updatedTimber.root;
  }

  static calcHash(block) {
    return calcBlockHash(block);
  }

  static calcFrontierHash(frontier) {
    return calculateFrontierHash(frontier);
  }

  // remove properties that do not get sent to the blockchain returning
  // a new object (don't mutate the original)
  static buildSolidityStruct(block) {
    return buildBlockSolidityStruct(block);
  }
}

export default Block;
