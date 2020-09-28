/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import deposit from '../services/deposit.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    deposit(res.body);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});
