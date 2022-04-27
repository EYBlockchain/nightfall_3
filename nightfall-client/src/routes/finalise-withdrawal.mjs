/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { finaliseWithdrawal } from '../services/finalise-withdrawal.mjs';
import {
  getTransactionByTransactionHash,
  getBlockByTransactionHash,
} from '../services/database.mjs';
import { getTransactionHashSiblingInfo } from '../services/commitment-storage.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`finalise-withdrawal endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactionHash } = req.body;
    const block = await getBlockByTransactionHash(transactionHash);
    const transactions = await Promise.all(
      block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
    );
    const index = transactions.findIndex(f => f.transactionHash === transactionHash);

    const { transactionHashSiblingPath, transactionHashesRoot } =
      await getTransactionHashSiblingInfo(transactions[index].transactionHash);
    const siblingPath = [transactionHashesRoot].concat(
      transactionHashSiblingPath.path.map(p => p.value).reverse(),
    );

    const { rawTransaction: txDataToSign } = await finaliseWithdrawal(
      block,
      transactions[index],
      index,
      siblingPath,
    );
    logger.debug('returning raw transaction');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
