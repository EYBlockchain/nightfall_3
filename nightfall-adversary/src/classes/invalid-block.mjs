/**
An non adversarial or adversarial layer 2 Block class
*/
import config from 'config';
import Timber from 'common-files/classes/timber.mjs';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import {
  getLatestTree,
  getLatestBlockInfo,
  getTransactionsOnChain,
  getSpentTransactionsOnChain,
} from '../services/database.mjs';
import Block from './block.mjs';

const { ZERO } = config;

/**
This BadBlock class inherits from the Block class.
It is primarily meant to be used for created invalid blocks
*/
class InvalidBlock extends Block {
  // We use a Builder pattern for all invalid block creations because it's very
  // bad form to return a promise from a constructor which should return a
  // fully-formed object. Also, we're too cool for an init() function.
  // Most of the builder functions replicate Block class' build except for the
  // error introduced. Refer to comments in Block class' build to understand code

  // This will build a block with incorrect root
  static async incorrectRootBuild(components) {
    const { proposer, transactions } = components;
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    // Error introduced here
    this.localRoot = (await rand(32)).hex();
    const blockHash = this.calcHash(
      {
        proposer,
        root: this.localRoot,
        leafCount: timber.leafCount,
        nCommitments,
        blockNumberL2,
        previousBlockHash,
      },
      transactions,
    );
    this.localPreviousBlockHash = blockHash;
    return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      leafCount: timber.leafCount,
      root: this.localRoot,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
    });
  }

  // This will build a block with duplicate transaction
  static async duplicateTransactionBuild(components) {
    const { proposer, transactions } = components;
    // Error introduced here. Retrieving a transaction on chain
    // and replacing the first valid transaction that will be submitted
    // in a block
    const [duplicateTransaction] = await getTransactionsOnChain(1);
    transactions[0] = duplicateTransaction;
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
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

  // This will build a block with invalid deposit transaction

  static async invalidTransactionBuild(components) {
    const { proposer } = components;
    const { transactions } = components;
    // error introduced here
    // if both tokenID and value are 0 for deposit, then this is an invalid deposit transaction
    await Promise.all(
      transactions.map(async transaction => {
        if (transaction.tokenType === 0) {
          // eslint-disable-next-line no-param-reassign
          transaction.tokenId =
            '0x0000000000000000000000000000000000000000000000000000000000000001';
        } else {
          // (transactions.tokenType === 1)
          // eslint-disable-next-line no-param-reassign
          transaction.value = '0x0000000000000000000000000000000000000000000000000000000000000001';
        }
      }),
    );
    // if(transactions[0].tokenType === 2), there is nothing to manipulate as both tokenId or value can be zero. This function does not called
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
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

  // This will build a block with incorrect historic root
  static async incorrectHistoricRootBuild(components) {
    const { proposer, transactions } = components;
    // error introduced here. Changing the historic root to a random value
    await Promise.all(
      transactions.map(async transaction => {
        const tx = transaction;
        tx.historicRootBlockNumberL2 = (await rand(8)).hex();
      }),
    );
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
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

  // This will build a block with incorrect proof
  static async incorrectProofBuild(components) {
    const { proposer, transactions } = components;
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    // error introduced here
    // we use the same proof of the next transaction but this should fail verify
    // because the public input hash used for verification does not correspond to
    // this proof
    transactions[0].proof = transactions[1].proof;
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
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

  // This will build a block with duplicate nullifier
  static async duplicateNullifierBuild(components) {
    const { proposer, transactions } = components;
    const spentTransaction = await getSpentTransactionsOnChain(1);
    const { nullifiers: duplicateNullifiers } = spentTransaction[0];
    await Promise.all(
      transactions.map(async transaction => {
        // eslint-disable-next-line no-param-reassign
        [transaction.nullifiers[0]] = [duplicateNullifiers[0]];
      }),
    );
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
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

  // This will build a block with incorrect leaf count
  static async incorrectLeafCountBuild(components) {
    const { proposer, transactions } = components;
    const { blockNumberL2: dbPrevBlockNumberL2, blockHash: dbBlockHash } =
      await getLatestBlockInfo();
    let blockNumberL2 = dbPrevBlockNumberL2 + 1;
    let previousBlockHash = dbBlockHash;
    let timber;
    if (blockNumberL2 >= this.localBlockNumberL2) {
      this.localBlockNumberL2 = blockNumberL2;
      this.localPreviousBlockHash = previousBlockHash;
      timber = await getLatestTree();
    } else {
      blockNumberL2 = this.localBlockNumberL2;
      previousBlockHash = this.localPreviousBlockHash;
      timber = new Timber(this.localRoot, this.localFrontier, this.localLeafCount);
    }
    const leafValues = transactions
      .map(transaction => transaction.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const nCommitments = leafValues.length;
    const updatedTimber = Timber.statelessUpdate(timber, leafValues);
    this.localLeafCount += leafValues.length;
    this.localFrontier = updatedTimber.frontier;
    this.localBlockNumberL2 += 1;
    this.localRoot = updatedTimber.root;
    // error introduced here
    // we don't want to ruin the localLeafCount in case the adversary wants
    // to submit good blocks after this, so we leave this unchanged.
    // while creating block and calculating hash we manipulate the leaf
    // count to be invalid
    let invalidLeafCount = timber.leafCount - 100;
    if (invalidLeafCount < 0) invalidLeafCount = -invalidLeafCount;

    const blockHash = this.calcHash(
      {
        proposer,
        root: updatedTimber.root,
        leafCount: invalidLeafCount,
        nCommitments,
        blockNumberL2,
        previousBlockHash,
      },
      transactions,
    );
    this.localPreviousBlockHash = blockHash;
    return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      leafCount: invalidLeafCount,
      root: updatedTimber.root,
      blockHash,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
    });
  }

  // will call the relevant invalid build function based on the invalid block txType
  // provided
  static async invalidBuild(components) {
    const { proposer, transactions, invalidBlockType } = components;
    let block;
    switch (invalidBlockType) {
      case 'IncorrectRoot': {
        block = await this.incorrectRootBuild({ proposer, transactions });
        break;
      }
      case 'DuplicateTransaction': {
        block = await this.duplicateTransactionBuild({ proposer, transactions });
        break;
      }
      case 'InvalidTransaction': {
        block = await this.invalidTransactionBuild({ proposer, transactions });
        break;
      }
      case 'IncorrectHistoricRoot': {
        block = await this.incorrectHistoricRootBuild({ proposer, transactions });
        break;
      }
      case 'IncorrectProof': {
        block = await this.incorrectProofBuild({ proposer, transactions });
        break;
      }
      case 'DuplicateNullifier': {
        block = await this.duplicateNullifierBuild({ proposer, transactions });
        break;
      }
      case 'IncorrectLeafCount': {
        block = await this.incorrectLeafCountBuild({ proposer, transactions });
        break;
      }
      default:
        break;
    }
    return block;
  }
}

export default InvalidBlock;
