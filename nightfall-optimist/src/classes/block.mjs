/**
An optimistic layer 2 Block class
*/
import config from 'config';
import { getFrontier } from '../utils/timber.mjs';
import mt from '../utils/crypto/merkle-tree/merkle-tree.mjs';
import Web3 from '../utils/web3.mjs';
import { compressProof } from '../utils/curve-maths/curves.mjs';
import { getContractInstance } from '../utils/contract.mjs';

const { ZERO, PROPOSE_BLOCK_TYPES, CHALLENGES_CONTRACT_NAME } = config;
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

  blockHash; // null value as explained above

  nCommitments; // number of commitments in the block

  blockNumberL2; // the number (index) of this Layer 2 block

  static localLeafCount = 0; // ensure this is less than Timber to start with

  static localFrontier = [];

  constructor(asyncParams) {
    if (asyncParams === undefined) throw new Error('Cannot be called directly');
    const { proposer, transactionHashes, leafCount, root, blockHash, nCommitments, blockNumberL2 } =
      asyncParams;
    this.leafCount = leafCount;
    this.proposer = proposer;
    this.transactionHashes = transactionHashes;
    this.root = root;
    this.blockHash = blockHash;
    this.nCommitments = nCommitments;
    this.blockNumberL2 = blockNumberL2;
  }

  // computes the root and hash. We use a Builder pattern because it's very
  // bad form to return a promise from a constructor -
  // which should return a fully-formed object. Also, we're too cool for an
  // init() function.
  static async build(components) {
    const { proposer, transactions } = components;
    let { currentLeafCount } = components;
    // the only place to get the next block number is from the blockchain:
    const proposersContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
    const blockNumberL2 = await proposersContractInstance.methods.getBlockNumberL2().call();

    // we have to get the current frontier from Timber, so that we can compute
    // the new root, bearing in mind that the transactions in this block won't
    // be in Timber yet.  However, Timber has a handy update
    // interface, which will, inter-alia, return that very frontier.
    // However, it's possible the previous block that we computed hasn't been
    // added to Timber yet, in which case the Frontier will be wrong. We can
    // detect that if we remember what the leafCount should actually be, and
    // if it's ahead of what Timber thinks, we compute the new Frontier locally
    // starting from the last value we have.
    // Of course, it's possible that Timber does a rollback.  That will mess up
    // our local calculations and make our locally stored values incorrect.
    // We need to reset the local values in that case.
    let frontier;
    // see if Timber is up to date with our blocks and act accordingly
    if (currentLeafCount >= this.localLeafCount) {
      // looks like Timber is up to date so use Timber values
      frontier = await getFrontier();
      // Update localLeafCount instead of relying on the incrementing below
      // in case we are joining the network midway.
      this.localLeafCount = currentLeafCount;
    } else {
      // Timber appears to be behind, so us locally stored values
      frontier = this.localFrontier;
      currentLeafCount = this.localLeafCount;
    }
    // extract the commitment hashes from the transactions
    // we filter out zeroes commitments that can come from withdrawals
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    // compute the root using Timber's code
    const { root, newFrontier } = await updateNodes(leafValues, currentLeafCount, frontier);
    const leafCount = currentLeafCount || 0;
    // remember the updated values in case we need them for the next block.
    this.localLeafCount += leafValues.length;
    this.localFrontier = newFrontier;
    // compute the keccak hash of the proposeBlock signature
    const blockHash = this.calcHash({ proposer, root, leafCount, nCommitments }, transactions);
    // note that the transactionHashes array is not part of the on-chain block
    // but we compute it here for convenience. It needs removing before sending
    // a block object to the blockchain.
    return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      leafCount,
      root,
      blockHash,
      nCommitments,
      blockNumberL2,
    });
  }

  // we cache the leafCount in case Timber isn't up to date, however we
  // need to reset the cache in the event of a rollback or we'll make a block
  // with the wrong leafCount.
  static rollback() {
    this.localLeafCount = 0;
  }

  static checkHash(block, transactions) {
    return this.calcHash(block, transactions) === block.blockHash;
  }

  static calcHash(block, transactions) {
    const web3 = Web3.connection();
    const { proposer, root, leafCount, nCommitments, blockNumberL2 } = block;
    const blockArray = [proposer, root, leafCount, nCommitments, blockNumberL2];
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
    const { proposer, root, leafCount, nCommitments, blockNumberL2 } = block;
    return {
      proposer,
      root,
      leafCount: Number(leafCount),
      nCommitments: Number(nCommitments),
      blockNumberL2: Number(blockNumberL2),
    };
  }
}

export default Block;
