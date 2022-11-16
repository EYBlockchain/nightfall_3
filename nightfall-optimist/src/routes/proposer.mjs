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
  getContractAddress,
  getContractInstance,
  waitForContract,
  web3,
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
import auth from '../utils/auth.mjs';

const router = express.Router();
const { TIMBER_HEIGHT, HASH_TYPE } = config;
const { STATE_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME, SHIELD_CONTRACT_NAME, ZERO } = constants;

let proposer;
export function setProposer(p) {
  proposer = p;
}

/**
 * @openapi
 *  /proposer/register:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Register Proposer.
 *      description: Route to return a raw transaction that registers a proposer. This just
 *        provides the tx data, the user will need to append the registration bond
 *        amount. The user must post the address being registered.  This is for the
 *        Optimist app to use for it to decide when to start proposing blocks.  It is not
 *        part of the unsigned blockchain transaction that is returned.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Proposer'
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessProposerRegister'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/register', auth, async (req, res, next) => {
  const ethAddress = req.app.get('ethAddress');
  const ethPrivateKey = req.app.get('ethPrivateKey');

  const { url = '', stake = 0, fee = 0 } = req.body;

  try {
    // Recreate Proposer, State contracts
    const proposersContractInstance = await waitForContract(PROPOSERS_CONTRACT_NAME);
    const proposersContractAddress = await getContractAddress(PROPOSERS_CONTRACT_NAME);
    const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);

    // Validate url, stake
    if (url === '') {
      throw new Error('Rest API URL not provided');
    }

    const minimumStake = await stateContractInstance.methods.getMinimumStake().call();
    if (stake < minimumStake) {
      throw new Error(`Given stake is below ${minimumStake} Wei`);
    }

    // Check if the proposer is already registered on the blockchain
    const proposerAddresses = (await getProposers()).map(p => p.thisAddress);
    const isRegistered = proposerAddresses.includes(ethAddress);

    let txDataToSign = '';
    let receipt;
    if (!isRegistered) {
      logger.debug('Register new proposer...');
      txDataToSign = await proposersContractInstance.methods.registerProposer(url, fee).encodeABI();
      const tx = {
        from: ethAddress,
        to: proposersContractAddress,
        data: txDataToSign,
        value: stake,
        gas: 8000000,
      };
      const signedTx = await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
      receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      logger.debug(`Transaction receipt ${receipt}`);
    } else {
      logger.warn('Proposer was already registered, registration attempt ignored!');
    }

    /*
      when we get to here, either the proposer was already registered (txDataToSign === '')
      or we're just about to register them. We may or may not be registed locally
      with optimist though. Let's check and fix that if needed.
     */
    if (!(await isRegisteredProposerAddressMine(ethAddress))) {
      logger.debug('Registering proposer locally');
      await setRegisteredProposerAddress(ethAddress, url); // save the registration address

      /*
        We've just registered with optimist but if we were already registered on the blockchain,
        we should check if we're the current proposer and, if so, set things up so we start
        making blocks immediately
       */
      if (txDataToSign === '') {
        logger.warn(
          'Proposer was already registered on the blockchain but not with this Optimist instance - registering locally',
        );
        const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
        if (ethAddress === currentProposer.thisAddress) {
          proposer.isMe = true;
          await enqueueEvent(() => logger.info('Start Queue'), 0); // kickstart the queue
        }
      }
    }
    res.json({ receipt });
  } catch (err) {
    next(err);
  }
});

/**
 * Function to update proposer's URL
 * @TODO endpoint could just update params according to the given info (should PATCH instead of update all)
 */

/**
 * @openapi
 *  /proposer/update:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Update Proposer.
 *      description: Route to update proposer's URL.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Proposer'
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessProposerUpdate'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/update', auth, async (req, res, next) => {
  const ethAddress = req.app.get('ethAddress');
  const ethPrivateKey = req.app.get('ethPrivateKey');

  const { url = '', stake = 0, fee = 0 } = req.body;

  try {
    // Recreate Proposer contracts
    const proposersContractInstance = await waitForContract(PROPOSERS_CONTRACT_NAME);
    const proposersContractAddress = await getContractAddress(PROPOSERS_CONTRACT_NAME);

    // Validate url
    if (url === '') {
      throw new Error('Rest API URL not provided');
    }

    const txDataToSign = await proposersContractInstance.methods
      .updateProposer(url, fee)
      .encodeABI();
    const tx = {
      from: ethAddress,
      to: proposersContractAddress,
      data: txDataToSign,
      value: stake,
      gas: 8000000,
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    res.json({ receipt });

    // Update db
    await setRegisteredProposerAddress(ethAddress, url); // save the registration address and URL
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /proposer/current-proposer:
 *    get:
 *      tags:
 *      - Proposer
 *      summary: Current Proposer.
 *      description: Returns the current proposer.
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessCurrentProposer'
 *        400:
 *          $ref: '#/components/responses/BadRequest'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
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
 * @openapi
 *  /proposer/proposers:
 *    get:
 *      tags:
 *      - Proposer
 *      summary: Proposers List.
 *      description: Returns the current proposer.
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessProposerList'
 *        400:
 *          $ref: '#/components/responses/BadRequest'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
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
 * @openapi
 *  /proposer/de-register:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Deregister Proposer.
 *      description: Route that deregister a proposer.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessDeregisterProposer'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/de-register', auth, async (req, res, next) => {
  const ethAddress = req.app.get('ethAddress');
  const ethPrivateKey = req.app.get('ethPrivateKey');

  try {
    // Recreate Proposer contract
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const proposersContractAddress = await getContractAddress(PROPOSERS_CONTRACT_NAME);

    // Remove the proposer by updating the blockchain state
    const txDataToSign = await proposersContractInstance.methods.deRegisterProposer().encodeABI();
    const tx = {
      from: ethAddress,
      to: proposersContractAddress,
      data: txDataToSign,
      gas: 8000000,
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.debug(`Transaction receipt ${receipt}`);

    // Update db
    await deleteRegisteredProposerAddress(ethAddress);

    res.json({ receipt });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /proposer/withdrawStake:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Withdraw Stake.
 *      description: Route to withdraw stake for a de-registered proposer.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessWithdrawStake'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/withdrawStake', auth, async (req, res, next) => {
  try {
    const proposerContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposerContractInstance.methods.withdrawStake().encodeABI();
    res.json({ txDataToSign });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 *  /proposer/pending-payments:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Pending Payments.
 *      description: Function to get pending blocks payments for a proposer.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessPendingPayments'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/pending-payments', auth, async (req, res, next) => {
  const { proposerAddress } = req.query;
  logger.debug(`requested pending payments for proposer ${proposer}`);

  const pendingPayments = [];
  // get blocks by proposer
  try {
    const blocks = await findBlocksByProposer(proposerAddress);
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);

    for (let i = 0; i < blocks.length; i++) {
      let pending;
      let challengePeriod = false;
      try {
        // eslint-disable-next-line no-await-in-loop
        pending = await shieldContractInstance.methods
          .isBlockPaymentPending(blocks[i].blockNumberL2)
          .call();
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
 * @openapi
 *  /proposer/stake:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Get Stake.
 *      description: Function to get the stake for a proposer.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessCurrentStake'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        400:
 *          $ref: '#/components/responses/BadRequest'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/stake', auth, async (req, res, next) => {
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
 * @openapi
 *  /proposer/withdraw:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Proposer
 *      summary: Finalise Withdraw.
 *      description: Function to withdraw funds owing to an account.  This could be profits made Through a successful challenge or proposing state updates. This just provides the tx data, the user will need to call the blockchain client.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessWithdrawPayment'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/withdraw', auth, async (req, res, next) => {
  try {
    const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
    const txDataToSign = await proposersContractInstance.methods.withdraw().encodeABI();

    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /proposer/payment:
 *   post:
 *     security:
 *       - ApiKeyAuth: []
 *     tags:
 *     - Proposer
 *     summary: Initiate Withdraw Payment.
 *     description: Function to get payment for proposing L2 block.  This should be called only after the block is finalised. It will authorise the payment as a pending withdrawal and then /withdraw needs to be called to recover the money.
 *     parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *     requestBody:
 *       $ref: '#/components/requestBodies/ProposerPayment'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SuccessProposerPayment'
 *       401:
 *          $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/payment', auth, async (req, res, next) => {
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
 * @openapi
 * /proposer/change:
 *   get:
 *     security:
 *       - ApiKeyAuth: []
 *     tags:
 *     - Proposer
 *     summary: Change Current Proposer.
 *     description: Function to change the current proposer (assuming their time has elapsed). This just provides the tx data, the user will need to call the blockchain client.
 *     parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SuccessChangeProposer'
 *       401:
 *          $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/change', auth, async (req, res, next) => {
  const ethAddress = req.app.get('ethAddress');
  const ethPrivateKey = req.app.get('ethPrivateKey');

  try {
    // Recreate State contract
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const stateContractAddress = await getContractAddress(STATE_CONTRACT_NAME);

    // Attempt to rotate proposer currently proposing blocks
    const txDataToSign = await stateContractInstance.methods.changeCurrentProposer().encodeABI();
    const tx = {
      from: ethAddress,
      to: stateContractAddress,
      data: txDataToSign,
      gas: 8000000,
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.debug(`Transaction receipt ${receipt}`);

    res.json({ receipt });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /proposer/mempool:
 *   get:
 *     tags:
 *     - Proposer
 *     summary: Get Mempool of Transactions.
 *     description: Get the transactions of the mempool that the proposer is connected to.
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       400:
 *          $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
 * @openapi
 * /proposer/encode:
 *   post:
 *     security:
 *       - ApiKeyAuth: []
 *     tags:
 *     - Proposer
 *     summary: Encode.
 *     description:
 *     parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       401:
 *          $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/encode', auth, async (req, res, next) => {
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

/**
 * @openapi
 * /proposer/offchain-transaction:
 *   post:
 *     tags:
 *     - Proposer
 *     summary: Offchain Transaction.
 *     description: Offchain transaction executed by a client.
 *     responses:
 *       200:
 *         $ref: '#/components/responses/Success'
 *       400:
 *          $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/offchain-transaction', async (req, res) => {
  const { transaction } = req.body;
  /*
    When a transaction is built by client, they are generalised into hex(32) interfacing with web3
    The response from on-chain events converts them to saner string values (e.g. uint64 etc).
    Since we do the transfer off-chain, we do the conversation manually here.
   */
  const { transactionType, fee } = transaction;
  try {
    switch (Number(transactionType)) {
      case 1:
      case 2: {
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
        break;
      }
      default:
        res.sendStatus(400);
        break;
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
