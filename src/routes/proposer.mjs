/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import Block from '../classes/block.mjs';

const router = express.Router();
const { SHIELD_CONTRACT_NAME } = config;

/**
 * Function to return a raw transaction that registers a proposer.  This just
 * provides the tx data, the user will need to append the registration bond
 * amount
 */
router.post('/register', async (req, res, next) => {
  logger.debug(`register proposal endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods.registerProposer().encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
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
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const proposers = await shieldContractInstance.methods.getProposers().call();
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
  logger.debug(`de-register proposal endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods.deRegisterProposer().encodeABI();
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
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods.withdraw().encodeABI();
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
 */
router.post('/propose', async (req, res, next) => {
  logger.debug(`propose endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactions, proposer, currentLeafCount } = req.body;
    // use the information we've been POSTED to assemble a block
    // we use a Builder pattern because an async constructor is bad form
    const block = await Block.build({ transactions, proposer, currentLeafCount });
    logger.debug(`New block assembled ${JSON.stringify(block, null, 2)}`);
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods
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
 * client.
 */
router.get('/change', async (req, res, next) => {
  logger.debug(`change endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods.changeCurrentProposer().encodeABI();
    logger.debug('returning raw transaction data');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
