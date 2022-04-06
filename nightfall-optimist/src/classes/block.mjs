/**
An optimistic layer 2 Block class
*/
import config from 'config';
import Timber from 'common-files/classes/timber.mjs';
import Web3 from 'common-files/utils/web3.mjs';
import { compressProof } from 'common-files/utils/curve-maths/curves.mjs';
import { getLatestTree, getLatestBlockInfo } from '../services/database.mjs';

const { ZERO, PROPOSE_BLOCK_TYPES } = config;

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

  blockHash; // null value as explained above

  nCommitments; // number of commitments in the block

  blockNumberL2; // the number (index) of this Layer 2 block

  previousBlockHash; // the block hash of the previous block (for re-assembling the chain after a reorg)

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
      leafCount,
      root,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
    } = asyncParams;
    this.leafCount = leafCount;
    this.proposer = proposer;
    this.transactionHashes = transactionHashes;
    this.root = root;
    this.blockHash = blockHash;
    this.nCommitments = nCommitments;
    this.blockNumberL2 = blockNumberL2;
    this.previousBlockHash = previousBlockHash;
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
    if (blockNumberL2 > this.localBlockNumberL2) {
      // Make blocks with our on-chain values.
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      // Make blocks with our local values.
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    // extract the commitment hashes from the transactions
    // we filter out zeroes commitments that can come from withdrawals
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;

    // Stateless update our frontier and root
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    // remember the updated values in case we need them for the next block.
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
    // compute the keccak hash of the proposeBlock signature
    const blockHash = this.calcHash(
      {
        proposer,
        root: updatedTimber.root,
        leafCount: timber.leafCount,
        nCommitments,
        blockNumberL2,
        previousBlockHash,
      },
      transactions,
    );
    this.localPreviousBlockHash = blockHash;
    // note that the transactionHashes array is not part of the on-chain block
    // but we compute it here for convenience. It needs removing before sending
    // a block object to the blockchain.
    return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      leafCount: timber.leafCount,
      root: updatedTimber.root,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
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

  static checkHash(block, transactions) {
    return this.calcHash(block, transactions) === block.blockHash;
  }

  static calcHash(block, transactions) {
    const web3 = Web3.connection();
    const { proposer, root, leafCount, blockNumberL2, previousBlockHash } = block;
    const blockArray = [leafCount, proposer, root, blockNumberL2, previousBlockHash];
    const transactionsArray = transactions.map(t => {
      const {
        value,
        historicRootBlockNumberL2,
        transactionType,
        tokenType,
        tokenId,
        ercAddress,
        recipientAddress,
        commitments,
        nullifiers,
        compressedSecrets,
        proof,
      } = t;
      return [
        value,
        historicRootBlockNumberL2,
        transactionType,
        tokenType,
        tokenId,
        ercAddress,
        recipientAddress,
        commitments,
        nullifiers,
        compressedSecrets,
        compressProof(proof),
      ];
    });
    const encoded = web3.eth.abi.encodeParameters(PROPOSE_BLOCK_TYPES, [
      blockArray,
      transactionsArray,
    ]);
    return web3.utils.soliditySha3({ t: 'bytes', v: encoded });
  }

  // remove properties that do not get sent to the blockchain returning
  // a new object (don't mutate the original)
  static buildSolidityStruct(block) {
    const { proposer, root, leafCount, blockNumberL2, previousBlockHash } = block;
    return {
      leafCount: Number(leafCount),
      proposer,
      root,
      blockNumberL2: Number(blockNumberL2),
      previousBlockHash,
    };
  }
}

export default Block;
