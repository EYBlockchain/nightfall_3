/**
 * Sends transactions to the Shield contract
 */
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';

const router = express.Router();
const { SHIELD_CONTRACT_NAME } = constants;
const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

/**
 * 
 * {
 *  fee,
 *  transactionType: 0,
 *  tokenType: items.tokenType,
 *  tokenId,
 *  value,
 *  ercAddress,
 *  commitments: [commitment],
 *  proof,
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    const { optimisticDepositTransaction: transaction } = req.body;

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticDepositTransaction))
      .encodeABI();

    res.json({ transactrawTransactionion });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
