/**
 Routes to perform whitelist manager work
 */

import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import {
  addUserToWhitelist,
  removeUserFromWhitelist,
  isWhitelisted,
  validateCertificate,
} from '../services/kyc.mjs';

const router = express.Router();

router.get('/check', async (req, res, next) => {
  try {
    const { address } = req.query;
    logger.debug(`Details requested with address ${address}`);
    const whitelisted = await isWhitelisted(address);
    res.json({ isWhitelisted: whitelisted });
  } catch (err) {
    next(err);
  }
});

/**
 Add a use to a whitelist (only works if user is a whitelist manager, otherwise just wastes gas)
 */
router.post('/add', async (req, res, next) => {
  const { address } = req.body;
  try {
    const response = await addUserToWhitelist(address);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 Add a use to a whitelist (only works if user is a relevant (to the group) whitelist manager, otherwise just wastes gas)
 */
router.post('/remove', async (req, res, next) => {
  const { address } = req.body;
  try {
    const response = await removeUserFromWhitelist(address);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 Validate a certificate (which will also add the user to the whitelist if the certificate is valid and the signature over
 their ethereum address checks out). The signature can be falsey if we don't want to whitelist the address but are just validating
 the certificate.  We might want to do this for an intermediate certificate for example.
 */
router.post('/validate', async (req, res, next) => {
  const { certificate, ethereumAddressSignature } = req.body;
  if (!certificate.type === 'Buffer') next(new Error('Certificate is not a buffer'));
  try {
    const response = await validateCertificate(
      Buffer.from(certificate.data),
      ethereumAddressSignature ? Buffer.from(ethereumAddressSignature) : null,
    );
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
