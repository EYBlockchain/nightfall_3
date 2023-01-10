/**
 * Routes for managing a proposer.
 * Some transactions are so simple that, we don't split out a separate service
 * module but handle the entire request here.
 */
import express from 'express';
import config from 'config';
import Timber from '@polygon-nightfall/common-files/classes/timber.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import {
  getContractInstance,
  waitForContract,
} from '@polygon-nightfall/common-files/utils/contract.mjs';
import { enqueueEvent } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import Block from '../classes/block.mjs';
import { Transaction, TransactionError } from '../classes/index.mjs';
import {
  setRegisteredProposerAddress,
  isRegisteredProposerAddressMine,
  deleteRegisteredProposerAddress,
  getMempoolTransactions,
  getLatestTree,
  findBlocksByProposer,
  getBlockByBlockHash,
} from '../services/database.mjs';
import transactionSubmittedEventHandler from '../event-handlers/transaction-submitted.mjs';
import getProposers from '../services/proposer.mjs';

const router = express.Router();
const { TIMBER_HEIGHT, HASH_TYPE } = config;
const { STATE_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME, SHIELD_CONTRACT_NAME, ZERO } = constants;

let proposer;
export function setProposer(p) {
  proposer = p;
}

/**
 * Function to return a raw transaction that registers a proposer.  This just
 * provides the tx data, the user will need to append the registration bond
 * amount.  The user must post the address being registered.  This is for the
 * Optimist app to use for it to decide when to start proposing blocks.  It is * not part of the unsigned blockchain transaction that is returned.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { address, url = '', fee = 0 } = req.body;
    if (url === '') {
      throw new Error('Rest API URL not provided');
    }
    const proposersContractInstance = await waitForContract(PROPOSERS_CONTRACT_NAME);
    // the first thing to do is to check if the proposer is already registered on the blockchain
    const proposers = (await getProposers()).map(p => p.thisAddress);
    // if not, let's register it
    let txDataToSign = '';
    if (!proposers.includes(address)) {
      txDataToSign = await proposersContractInstance.methods.registerProposer(url, fee).encodeABI();
    } else {
      logger.warn(
        'Proposer was already registered on the blockchain - registration attempt ignored',
      );
    }

    /*
      when we get to here, either the proposer was already registered (txDataToSign === '')
      or we're just about to register them. We may or may not be registed locally
      with optimist though. Let's check and fix that if needed.
     */
    const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
    const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
    if (!(await isRegisteredProposerAddressMine(address))) {
      logger.debug('Registering proposer locally');
      await setRegisteredProposerAddress(address, url); // save the registration address

      /*
        We've just registered with optimist but if we were already registered on the blockchain,
        we should check if we're the current proposer and, if so, set things up so we start
        making blocks immediately
       */
      if (txDataToSign === '') {
        logger.warn(
          'Proposer was already registered on the blockchain but not with this Optimist instance - registering locally',
        );
        if (address === currentProposer.thisAddress) {
          proposer.isMe = true;
          await enqueueEvent(() => logger.info('Start Queue'), 0); // kickstart the queue
        }
      }
    } else if (address === currentProposer.thisAddress && !proposer.isMe) {
      logger.warn(
        'Proposer was already registered on the blockchain and with this Optimist instance, but proposer flag wasnt set - setting isMe flag',
      );
      proposer.isMe = true;
      proposer.address = address;
      await enqueueEvent(() => logger.info('Start Queue'), 0); // kickstart the queue
    }
    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to update proposer's URL
 */
router.post('/update', async (req, res, next) => {
  try {
    const { address, url = '', fee = 0 } = req.body;
    if (url === '') {
      throw new Error('Rest API URL not provided');
    }
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods
      .updateProposer(url, fee)
      .encodeABI();

    res.json({ txDataToSign });
    setRegisteredProposerAddress(address, url); // save the registration address and URL
  } catch (err) {
    next(err);
  }
});

/**
 * Returns the current proposer
 */
router.get('/current-proposer', async (req, res, next) => {
  try {
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const { thisAddress: currentProposer } = await stateContractInstance.methods
      .currentProposer()
      .call();

    res.json({ currentProposer });
  } catch (err) {
    next(err);
  }
});

/**
 * Returns a list of the registered proposers
 */
router.get('/proposers', async (req, res, next) => {
  try {
    const proposers = await getProposers();

    res.json({ proposers });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to return a raw transaction that de-registers a proposer.  This just
 * provides the tx data. The user has to call the blockchain client.
 */
router.post('/de-register', async (req, res, next) => {
  try {
    const { address = '' } = req.body;
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.deRegisterProposer().encodeABI();

    await deleteRegisteredProposerAddress(address);

    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to withdraw stake for a de-registered proposer
 */

router.post('/withdrawStake', async (req, res, next) => {
  try {
    const proposerContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposerContractInstance.methods.withdrawStake().encodeABI();
    res.json({ txDataToSign });
  } catch (error) {
    next(error);
  }
});

/**
 * Function to get pending blocks payments for a proposer.
 */
router.get('/pending-payments', async (req, res, next) => {
  const { proposerAddress } = req.query;

  const pendingPayments = [];
  // get blocks by proposer
  try {
    const blocks = await findBlocksByProposer(proposerAddress);
    console.log('----blocks---00000000000000---------------------********-', blocks);
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);

    for (let i = 0; i < blocks.length; i++) {
      let pending;
      let challengePeriod = false;
      try {
        // eslint-disable-next-line no-await-in-loop
        pending = await shieldContractInstance.methods
          .isBlockPaymentPending(blocks[i].blockNumberL2)
          .call();
          console.log('----pending-----', blocks[i].blockNumberL2, pending);
      } catch (e) {
        if (e.message.includes('Too soon to get paid for this block')) {
          challengePeriod = true;
          pending = true;
        } else {
          pending = false;
        }
      }

      if (pending) {
        pendingPayments.push({ blockHash: blocks[i].blockHash, challengePeriod });
      }
    }
    res.json({ pendingPayments });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to get stake for a proposer.
 */
router.get('/stake', async (req, res, next) => {
  logger.debug(`stake endpoint received GET`);
  const { proposerAddress } = req.query;
  logger.debug(`requested stake for proposer ${proposerAddress}`);

  try {
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const stakeAccount = await stateContractInstance.methods
      .getStakeAccount(proposerAddress)
      .call();

    res.json({
      amount: Number(stakeAccount[0]),
      challengeLocked: Number(stakeAccount[1]),
      time: Number(stakeAccount[2]),
    });
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
  try {
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.withdraw().encodeABI();

    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to get payment for proposing a L2 block.  This should be called only
 * after the block is finalised. It will authorise the payment as a pending
 * withdrawal and then /withdraw needs to be called to recover the money.
 */
router.post('/payment', async (req, res, next) => {
  const { blockHash } = req.body;
  try {
    const block = await getBlockByBlockHash(blockHash);
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    const txDataToSign = await shieldContractInstance.methods
      .requestBlockPayment(block)
      .encodeABI();

    res.json({ txDataToSign });
  } catch (err) {
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
  try {
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const txDataToSign = await stateContractInstance.methods.changeCurrentProposer().encodeABI();

    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to get mempool of a connected proposer
 */
router.get('/mempool', async (req, res, next) => {
  try {
    const mempool = await getMempoolTransactions();
    res.json({ result: mempool });
  } catch (err) {
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
  try {
    const { transactions, block } = req.body;

    const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
    const latestTree = await getLatestTree();
    let currentLeafCount = latestTree.leafCount;
    /*
      normally we re-compute the leafcount. If however block.leafCount is -ve
      that's a signal to use the value given (once we've flipped the sign back)
     */
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
      const { root, frontierTimber } = Timber.statelessUpdate(
        latestTree,
        leafValues,
        HASH_TYPE,
        TIMBER_HEIGHT,
      );
      block.root = root;
      block.frontierHash = await Block.calcFrontierHash(frontierTimber);
    }

    const newBlock = {
      proposer: block.proposer,
      transactionHashes: transactions.map(transaction => transaction.transactionHash),
      root: block.root,
      leafCount: currentLeafCount,
      nCommitments: block.nCommitments,
      blockNumberL2: block.blockNumberL2,
      previousBlockHash: block.previousBlockHash,
      frontierHash: block.frontierHash,
      transactionHashesRoot: block.transactionHashesRoot,
    };
    newBlock.blockHash = await Block.calcHash(newBlock, newTransactions);

    logger.debug({
      msg: 'New block encoded for test',
      newBlock,
    });

    const txDataToSign = await stateContractInstance.methods
      .proposeBlock(
        Block.buildSolidityStruct(newBlock),
        newTransactions.map(t => Transaction.buildSolidityStruct(t)),
      )
      .encodeABI();

    res.json({ txDataToSign, block: newBlock, transactions: newTransactions });
  } catch (err) {
    next(err);
  }
});

router.post('/offchain-transaction', async (req, res) => {
  const { transaction } = req.body;
  /*
    When a transaction is built by client, they are generalised into hex(32) interfacing with web3
    The response from on-chain events converts them to saner string values (e.g. uint64 etc).
    Since we do the transfer off-chain, we do the conversation manually here.
   */
  const { circuitHash, fee } = transaction;

  try {
    const stateInstance = await waitForContract(STATE_CONTRACT_NAME);
    const circuitInfo = await stateInstance.methods.getCircuitInfo(circuitHash).call();
    if (circuitInfo.isEscrowRequired) {
      res.sendStatus(400);
    } else {
      /*
          When comparing this with getTransactionSubmittedCalldata,
          note we dont need to decompressProof as proofs are only compressed if they go on-chain.
          let's not directly call transactionSubmittedEventHandler, instead, we'll queue it
         */
      await enqueueEvent(transactionSubmittedEventHandler, 1, {
        offchain: true,
        ...transaction,
        fee: Number(fee),
      });

      res.sendStatus(200);
    }
  } catch (err) {
    if (err instanceof TransactionError) {
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    } else {
      logger.error(err);
    }

    res.sendStatus(400);
  }
});

export default router;
