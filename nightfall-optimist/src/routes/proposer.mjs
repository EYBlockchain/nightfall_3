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
 * @openapi
 *  components:
 *    schemas:
 *      PendingPayments:
 *        type: array
 *        items:
 *          type: object
 *          properties:
 *            blockHash:
 *              type: string
 *            challengePeriod:
 *              type: boolean
 *        example:
 *           blockHash: "0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000"
 *           challengePeriod: false
 *      Proposer:
 *        type: object
 *        properties:
 *          url:
 *            type: string
 *            description: The proposer's url.
 *          stake:
 *            type: string
 *            description: The proposer's stake.
 *          fee:
 *            type: integer
 *            description: The proposer's fee.
 *        example:
 *           url: http://proposer1:8587
 *           stake: 0
 *           fee: 0
 *      TxDataToSign:
 *        type: object
 *        properties:
 *          txDataToSign:
 *            type: string
 *            description: The current proposer address.
 *        example:
 *           txDataToSign: "0x0d6022010000000000000"
 *      ProposersList:
 *        type: array
 *        items:
 *          type: object
 *          properties:
 *            0:
 *              type: string
 *              description: Current proposer address.
 *            1:
 *              type: string
 *              description: Previous proposer address.
 *            2:
 *              type: string
 *              description: Next proposer address.
 *            3:
 *              type: string
 *              description: Proposer's url.
 *            4:
 *              type: string
 *              description: Proposer's fee.
 *            5:
 *              type: boolean
 *              description: Proposer in.
 *            6:
 *              type: string
 *              description: Proposer index.
 *            thisAddress:
 *              type: integer
 *              description: Current proposer address.
 *            previousAddress:
 *              type: string
 *              description: Previous proposer address.
 *            nextAddress:
 *              type: string
 *              description: Next proposer address.
 *            url:
 *              type: string
 *              description: Proposer's url.
 *            fee:
 *              type: string
 *              description: Proposer's fee.
 *            inProposerSet:
 *              type: boolean
 *              description: Proposer in.
 *            indexProposerSet:
 *              type: string
 *              description: Proposer index.
 *        example:
 *          proposers: [{
 *            0: "0x0000000000000000000000000000000000000000",
 *            1: "0x0000000000000000000000000000000000000000",
 *            2: "0x0000000000000000000000000000000000000000",
 *            3: "",
 *            4: "0",
 *            5: false,
 *            6: "0",
 *            thisAddress: "0x0000000000000000000000000000000000000000",
 *            previousAddress: "0x0000000000000000000000000000000000000000",
 *            nextAddress: "0x0000000000000000000000000000000000000000",
 *            url: "",
 *            fee: "0",
 *            inProposerSet: false,
 *            indexProposerSet: "0"
 *          }]
 */

/**
 * @openapi
 *  /proposer/register:
 *    post:
 *      tags:
 *      - Proposer
 *      summary: Register Proposer.
 *      description: Route to return a raw transaction that registers a proposer. This just
 *        provides the tx data, the user will need to append the registration bond
 *        amount. The user must post the address being registered.  This is for the
 *        Optimist app to use for it to decide when to start proposing blocks.  It is not
 *        part of the unsigned blockchain transaction that is returned.
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Proposer'
 *      responses:
 *        200:
 *          description: Proposer updated.
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/TxDataToSign'
 *        500:
 *          description: Some error ocurred.
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
        const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
        const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
        if (address === currentProposer.thisAddress) {
          proposer.isMe = true;
          await enqueueEvent(() => logger.info('Start Queue'), 0); // kickstart the queue
        }
      }
    }
    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /proposer/update:
 *    post:
 *      tags:
 *      - Proposer
 *      summary: Update Proposer.
 *      description: Route to update proposer's URL.
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Proposer'
 *      responses:
 *        200:
 *          description: Proposer updated.
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/TxDataToSign'
 *        500:
 *          description: Some error ocurred.
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
 * @openapi
 *  /proposer/current-proposer:
 *    get:
 *      tags:
 *      - Proposer
 *      summary: Current Proposer.
 *      description: Returns the current proposer.
 *      responses:
 *        200:
 *          description: Current proposer returned.
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  currentProposer:
 *                    type: string
 *                    example: "0x0A2798E08B66A1a4188F4B239651C015aC587Bf8"
 *        500:
 *          description: Some error ocurred.
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
 *          description: Proposer updated.
 *          content:
 *            application/json:
 *              schema:
 *                type: array
 *                items:
 *                  $ref: '#/components/schemas/ProposersList'
 *        500:
 *          description: Some error ocurred.
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
 *      tags:
 *      - Proposer
 *      summary: Deregister Proposer.
 *      description: Route that deregister a proposer.
 *      responses:
 *        200:
 *          description: Proposer deregistered.
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/TxDataToSign'
 *        500:
 *          description: Some error ocurred.
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
 * @openapi
 *  /proposer/withdrawStake:
 *    post:
 *      tags:
 *      - Proposer
 *      summary: Withdraw Stake.
 *      description: Route to withdraw stake for a de-registered proposer.
 *      responses:
 *        200:
 *          description: Stake withdraw.
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/TxDataToSign'
 *        500:
 *          description: Some error ocurred.
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
 * @openapi
 *  /proposer/pending-payments:
 *    get:
 *      tags:
 *      - Proposer
 *      summary: Pending Payments.
 *      description: Function to get pending blocks payments for a proposer.
 *      responses:
 *        200:
 *          description: Pending payments recieved.
 *          content:
 *            application/json:
 *              schema:
 *                type: array
 *                items:
 *                  $ref: '#/components/schemas/PendingPayments'
 *        500:
 *          description: Some error ocurred.
 */
router.get('/pending-payments', async (req, res, next) => {
  const { proposerPayments = proposer } = req.query;
  const pendingPayments = [];
  // get blocks by proposer
  try {
    const blocks = await findBlocksByProposer(proposerPayments);
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
 *  /proposer/withdraw:
 *    get:
 *      tags:
 *      - Proposer
 *      summary: Finalise Withdraw.
 *      description: Function to withdraw funds owing to an account.  This could be profits made Through a successful challenge or proposing state updates. This just provides the tx data, the user will need to call the blockchain client.
 *      responses:
 *        200:
 *          description: Withdrawal created.
 *          content:
 *            application/json:
 *              schema:
 *                type: array
 *                items:
 *                  $ref: '#/components/schemas/TxDataToSign'
 *        500:
 *          description: Some error ocurred.
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
 * @openapi
 * /proposer/payment:
 *   post:
 *     tags:
 *     - Proposer
 *     summary: Initiate Withdraw Payment.
 *     description: Function to get payment for proposing L2 block.  This should be called only after the block is finalised. It will authorise the payment as a pending withdrawal and then /withdraw needs to be called to recover the money.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 description: Proposer address
 *                 example: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8'
 *               blockHash:
 *                 type: string
 *                 description: Hash of the payment
 *                 example: '0x7fe911936f773030ecaa1cf417b8c24e47cbf5e05b003b8f155bb10b0066956d'
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: An error occured
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
 * @openapi
 * /proposer/change:
 *   get:
 *     tags:
 *     - Proposer
 *     summary: Change Current Proposer.
 *     description: Function to change the current proposer (assuming their time has elapsed). This just provides the tx data, the user will need to call the blockchain client.
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: An error occured
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
 * @openapi
 * /proposer/mempool:
 *   get:
 *     tags:
 *     - Proposer
 *     summary: Get Mempool of Transactions.
 *     description: Get the transactions of the mempool that the proposer is connected to.
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: An error occured
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
 *     tags:
 *     - Proposer
 *     summary: Encode.
 *     description:
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: An error occured
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
 *         description: OK
 *       500:
 *         description: An error occured
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
