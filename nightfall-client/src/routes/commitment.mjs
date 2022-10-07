/**
 Route for commitment to access commitment data from the database
 */

import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import {
  getCommitmentBySalt,
  getWalletBalance,
  getWalletBalanceUnfiltered,
  getWalletCommitments,
  getWithdrawCommitments,
  getWalletPendingDepositBalance,
  getWalletPendingSpentBalance,
  getCommitments,
  getCommitmentsByCompressedZkpPublicKeyList,
  insertCommitmentsAndResync,
} from '../services/commitment-storage.mjs';

const router = express.Router();

router.get('/salt', async (req, res, next) => {
  logger.debug('commitment/salt endpoint received GET');
  try {
    const { salt } = req.query;
    const commitment = await getCommitmentBySalt(salt);
    if (commitment === null) logger.debug(`Found commitment ${commitment} for salt ${salt}`);
    else logger.debug(`No commitment found for salt ${salt}`);
    res.json({ commitment });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/balance', async (req, res, next) => {
  logger.debug('commitment/balance endpoint received GET');
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    logger.debug(
      `Details requested with compressedZkpPublicKey ${compressedZkpPublicKey} and ercList ${ercList}`,
    );
    let balance;
    if (compressedZkpPublicKey) balance = await getWalletBalance(compressedZkpPublicKey, ercList);
    else balance = await getWalletBalanceUnfiltered(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/pending-deposit', async (req, res, next) => {
  logger.debug('commitment/pending-deposit endpoint received GET');
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    logger.debug(
      `Details requested with compressedZkpPublicKey ${compressedZkpPublicKey} and ercList ${ercList}`,
    );
    const balance = await getWalletPendingDepositBalance(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/pending-spent', async (req, res, next) => {
  logger.debug('commitment/pending-spent endpoint received GET');
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    logger.debug(
      `Details requested with compressedZkpPublicKey ${compressedZkpPublicKey} and ercList ${ercList}`,
    );
    const balance = await getWalletPendingSpentBalance(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/commitments', async (req, res, next) => {
  logger.debug('commitment/commitments endpoint received GET');
  try {
    const commitments = await getWalletCommitments();
    res.json({ commitments });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * @description the endpoint that will save a list of commitments
 */
router.post('/save', async (req, res, next) => {
  logger.debug('commitment/save endpoint received POST');
  const listOfCommitments = req.body;
  try {
    const response = await insertCommitmentsAndResync(listOfCommitments);
    res.json(response);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * @description the endpoint that will send a reponse with all the
 * existent commitments for the list of compressedPkd received in the
 * request body. We're using POST for this endpoint, because if the
 * number of compressed keys per user increase the query params have
 * a size limit.
 * @author luizoamorim
 */
router.post('/compressedZkpPublicKeys', async (req, res, next) => {
  logger.debug('commitment/compressedZkpPublicKeys endpoint received POST');
  const listOfCompressedZkpPublicKey = req.body;
  try {
    const commitmentsByListOfCompressedZkpPublicKey =
      await getCommitmentsByCompressedZkpPublicKeyList(listOfCompressedZkpPublicKey);
    res.json({ commitmentsByListOfCompressedZkpPublicKey });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * @description the endpoint that will send a reponse with all the
 * existent commitments.
 * @author luizoamorim
 */
router.get('/', async (req, res, next) => {
  logger.debug('commitment/ endpoint received GET');
  try {
    const allCommitments = await getCommitments();
    res.json({ allCommitments });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/withdraws', async (req, res, next) => {
  logger.debug('commitment/withdraws endpoint received GET');
  try {
    const commitments = await getWithdrawCommitments();
    res.json({ commitments });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
