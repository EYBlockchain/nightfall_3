/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import config from 'config';
import Timber from 'common-files/classes/timber.mjs';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import Block from '../classes/block.mjs';
import { Transaction, TransactionError } from '../classes/index.mjs';
import {
  setRegisteredProposerAddress,
  deleteRegisteredProposerAddress,
  getMempoolTransactions,
  getLatestTree,
} from '../services/database.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';

const router = express.Router();
const { STATE_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME, SHIELD_CONTRACT_NAME, ZERO } = config;

/**
 * Function to return a raw transaction that registers a proposer.  This just
 * provides the tx data, the user will need to append the registration bond
 * amount.  The user must post the address being registered.  This is for the
 * Optimist app to use for it to decide when to start proposing blocks.  It is * not part of the unsigned blockchain transaction that is returned.
 */
router.post('/register', async (req, res, next) => {
  logger.debug(`register proposer endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { address, url = '' } = req.body;
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.registerProposer(url).encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
    setRegisteredProposerAddress(address, url); // save the registration address and URL
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to update proposer's URL
 */
router.post('/update', async (req, res, next) => {
  logger.debug(`update proposer endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { address, url = '' } = req.body;
    if (url === '') {
      throw new Error('Rest API URL not provided');
    }
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.updateProposer(url).encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
    setRegisteredProposerAddress(address, url); // save the registration address and URL
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Returns a list of the registered proposers
 */
router.get('/proposers', async (req, res, next) => {
  logger.debug(`list proposals endpoint received GET`);
  try {
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    // proposers is an on-chain mapping so to get proposers we need to key to start iterating
    // the safest to start with is the currentProposer
    const currentProposer = await stateContractInstance.methods.currentProposer().call();
    const proposers = [];
    let thisPtr = currentProposer.thisAddress;
    // Loop through the circular list until we run back into the currentProposer.
    do {
      // eslint-disable-next-line no-await-in-loop
      const proposer = await stateContractInstance.methods.proposers(thisPtr).call();
      proposers.push(proposer);
      thisPtr = proposer.nextAddress;
    } while (thisPtr !== currentProposer.thisAddress);

    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(proposers, null, 2)}`);
    res.json({ proposers });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to return a raw transaction that de-registers a proposer.  This just
 * provides the tx data. The user has to call the blockchain client.
 */
router.post('/de-register', async (req, res, next) => {
  logger.debug(`de-register proposer endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { address = '' } = req.body;
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.deRegisterProposer().encodeABI();
    await deleteRegisteredProposerAddress(address);
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to withdraw bond for a de-registered proposer
 */

router.post('/withdrawBond', async (req, res, next) => {
  logger.debug(`withdrawBond endpoint received GET`);
  try {
    const stateContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await stateContractInstance.methods.withdrawBond().encodeABI();
    res.json({ txDataToSign });
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

/**
 * Function to withdraw funds owing to an account.  This could be profits made
 * Through a successful challenge or proposing state updates. This just
 * provides the tx data, the user will need to call the blockchain client.
 */
router.get('/withdraw', async (req, res, next) => {
  logger.debug(`withdraw endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.withdraw().encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to get payment for proposing a L2 block.  This should be called only
 * after the block is finalised. It will authorise the payment as a pending
 * withdrawal and then /withdraw needs to be called to recover the money.
 */
router.post('/payment', async (req, res, next) => {
  logger.debug(`payment endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  const { block, blockNumberL2, transactions } = req.body;
  try {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods
      .requestBlockPayment(block, blockNumberL2, transactions)
      .encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to Propose a state update block  This just
 * provides the tx data, the user will need to call the blockchain client
 * @deprecated - this is now an automated process - no need to manually propose
 * a block
 */
router.post('/propose', async (req, res, next) => {
  logger.debug(`propose endpoint received POST`);
  logger.silly(`With content ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactions, proposer, currentLeafCount } = req.body;
    // use the information we've been POSTED to assemble a block
    // we use a Builder pattern because an async constructor is bad form
    const block = await Block.build({
      transactions,
      proposer,
      currentLeafCount,
    });
    logger.debug(`New block assembled ${JSON.stringify(block, null, 2)}`);
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const txDataToSign = await stateContractInstance.methods
      .proposeBlock(block, transactions)
      .encodeABI();
    logger.debug('returning raw transaction');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign, block, transactions });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});
/**
 * Function to change the current proposer (assuming their time has elapsed).
 * This just provides the tx data, the user will need to call the blockchain
 * client.  It is a convenience function, because the unsigned transaction is
 * for a parameterless function - therefore it's a constant and could be pre-
 * computed by the app that calls this endpoint.
 */
router.get('/change', async (req, res, next) => {
  logger.debug(`proposer/change endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods
      .changeCurrentProposer()
      .encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to get mempool of a connected proposer
 */
router.get('/mempool', async (req, res, next) => {
  logger.debug(`proposer/mempool endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const mempool = await getMempoolTransactions();
    logger.debug('returning mempool');
    res.json({ result: mempool });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Function to Propose a state update block  This just
 * provides the tx data, the user will need to call the blockchain client
 * @deprecated - this is now an automated process - no need to manually propose
 * a block
 */
router.post('/encode', async (req, res, next) => {
  logger.debug(`encode endpoint received POST`);
  logger.silly(`With content ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactions, block } = req.body;

    const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
    const latestTree = await getLatestTree();
    let currentLeafCount = latestTree.leafCount;
    // normally we re-compute the leafcount. If however block.leafCount is -ve
    // that's a signal to use the value given (once we've flipped the sign back)
    if (block.leafCount < 0) currentLeafCount = -block.leafCount;

    const newTransactions = await Promise.all(
      transactions.map(t => {
        const transaction = t;
        transaction.transactionHash = Transaction.calcHash(transaction);
        return transaction;
      }),
    );

    if (!block.root) {
      const leafValues = newTransactions
        .map(newTransaction => newTransaction.commitments.filter(c => c !== ZERO))
        .flat(Infinity);
      const { root } = Timber.statelessUpdate(latestTree, leafValues);
      block.root = root;
    }

    const newBlock = {
      proposer: block.proposer,
      transactionHashes: transactions.map(transaction => transaction.transactionHash),
      root: block.root,
      leafCount: currentLeafCount,
      nCommitments: block.nCommitments,
      blockNumberL2: block.blockNumberL2,
      previousBlockHash: block.previousBlockHash,
    };
    newBlock.blockHash = await Block.calcHash(newBlock, newTransactions);
    logger.debug(`New block encoded for test ${JSON.stringify(newBlock, null, 2)}`);
    const txDataToSign = await stateContractInstance.methods
      .proposeBlock(
        Block.buildSolidityStruct(newBlock),
        newTransactions.map(t => Transaction.buildSolidityStruct(t)),
      )
      .encodeABI();
    logger.debug('returning raw transaction');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign, block: newBlock, transactions: newTransactions });
  } catch (err) {
    logger.error(err.stack);
    next(err);
  }
});

router.post('/offchain-transaction', async (req, res) => {
  logger.debug(`proposer/offchain-transaction endpoint received POST`);
  logger.silly(`With content ${JSON.stringify(req.body, null, 2)}`);
  const { transaction } = req.body;
  // When a transaction is built by client, they are generalised into hex(32) interfacing with web3
  // The response from on-chain events converts them to saner string values (e.g. uint64 etc).
  // Since we do the transfer off-chain, we do the conversation manually here.
  const { transactionType, tokenType, value, historicRootBlockNumberL2, fee, ...tx } = transaction;
  try {
    switch (Number(transactionType)) {
      case 1:
      case 2:
      case 3: {
        await transactionSubmittedEventHandler({
          offchain: true,
          transactionType: Number(transactionType).toString(),
          tokenType: Number(tokenType).toString(),
          value: Number(value).toString(),
          fee: Number(fee).toString(),
          historicRootBlockNumberL2: historicRootBlockNumberL2.map(h => Number(h).toString()),
          ...tx,
        });
        res.sendStatus(200);
        break;
      }
      default:
        res.sendStatus(400);
        break;
    }
  } catch (err) {
    if (err instanceof TransactionError)
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    else logger.error(err.message);
    res.sendStatus(400);
  }
});

export default router;
