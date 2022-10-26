/**
 Route for commitment to access commitment data from the database
 */

import express from 'express';
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
  try {
    const { salt } = req.query;
    const commitment = await getCommitmentBySalt(salt);
    res.json({ commitment });
  } catch (err) {
    next(err);
  }
});

router.get('/balance', async (req, res, next) => {
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    let balance;
    if (compressedZkpPublicKey) balance = await getWalletBalance(compressedZkpPublicKey, ercList);
    else balance = await getWalletBalanceUnfiltered(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    next(err);
  }
});

router.get('/pending-deposit', async (req, res, next) => {
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    const balance = await getWalletPendingDepositBalance(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    next(err);
  }
});

router.get('/pending-spent', async (req, res, next) => {
  try {
    const { compressedZkpPublicKey, ercList } = req.query;
    const balance = await getWalletPendingSpentBalance(compressedZkpPublicKey, ercList);
    res.json({ balance });
  } catch (err) {
    next(err);
  }
});

router.get('/commitments', async (req, res, next) => {
  try {
    const commitments = await getWalletCommitments();
    res.json({ commitments });
  } catch (err) {
    next(err);
  }
});

/**
 * @description the endpoint that will save a list of commitments
 */
router.post('/save', async (req, res, next) => {
  const listOfCommitments = req.body;
  try {
    const response = await insertCommitmentsAndResync(listOfCommitments);
    res.json(response);
  } catch (err) {
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
  const listOfCompressedZkpPublicKey = req.body;
  try {
    const commitmentsByListOfCompressedZkpPublicKey =
      await getCommitmentsByCompressedZkpPublicKeyList(listOfCompressedZkpPublicKey);
    res.json({ commitmentsByListOfCompressedZkpPublicKey });
  } catch (err) {
    next(err);
  }
});

/**
 * @description the endpoint that will send a reponse with all the
 * existent commitments.
 * @author luizoamorim
 */
router.get('/', async (req, res, next) => {
  try {
    const allCommitments = await getCommitments();
    res.json({ allCommitments });
  } catch (err) {
    next(err);
  }
});

router.get('/withdraws', async (req, res, next) => {
  try {
    const commitments = await getWithdrawCommitments();
    res.json({ commitments });
  } catch (err) {
    next(err);
  }
});

export default router;
