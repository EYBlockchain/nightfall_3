/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import config from 'config';
import mt from 'common-files/utils/crypto/merkle-tree/merkle-tree.mjs';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import Block from '../classes/block.mjs';
import { Transaction, TransactionError } from '../classes/index.mjs';
import { setRegisteredProposerAddress } from '../services/database.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import { getFrontier, getLeafCount } from '../utils/timber.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';

const { updateNodes } = mt;
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
    const { address } = req.body;
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.registerProposer().encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
    setRegisteredProposerAddress(address); // save the registration address
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Returns a list of the registered proposers
 */
router.get('/proposers', async (req, res, next) => {
  logger.debug(`list proposals endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const proposers = await proposersContractInstance.methods.getProposers().call();
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
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.deRegisterProposer().encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
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
    let currentLeafCount = parseInt(await getLeafCount(), 10);
    // normally we re-compute the leafcount. If however block.leafCount is -ve
    // that's a signal to use the value given (once we've flipped the sign back)
    if (block.leafCount < 0) currentLeafCount = -block.leafCount;
    const blockNumberL2 = Number(await stateContractInstance.methods.getNumberOfL2Blocks().call());

    const newTransactions = await Promise.all(
      transactions.map(t => {
        const transaction = t;
        transaction.transactionHash = Transaction.calcHash(transaction);
        return transaction;
      }),
    );

    if (!block.root) {
      const frontier = await getFrontier();
      const leafValues = newTransactions
        .map(newTransaction => newTransaction.commitments.filter(c => c !== ZERO))
        .flat(Infinity);
      block.root = (await updateNodes(leafValues, currentLeafCount, frontier)).root;
    }

    const newBlock = {
      proposer: block.proposer,
      transactionHashes: transactions.map(transaction => transaction.transactionHash),
      root: block.root,
      leafCount: currentLeafCount,
      nCommitments: block.nCommitments,
      blockNumberL2,
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

router.post('/transfer', async (req, res) => {
  logger.debug(`transfer endpoint received POST`);
  logger.silly(`With content ${JSON.stringify(req.body, null, 2)}`);
  const { transaction } = req.body;
  try {
    switch (Number(transaction.transactionType)) {
      case 1:
      case 2:
      case 3: {
        await transactionSubmittedEventHandler({ offchain: true, ...transaction });
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
