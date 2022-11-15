/**
 Routes to validate x509 certificates
 */

import express from 'express';
import validateCertificate from '../services/x509.mjs';

const router = express.Router();

/**
 Validate a certificate (which will also add the user to the whitelist if the certificate is valid and the signature over
 their ethereum address checks out). The signature can be falsey if we don't want to whitelist the address but are just validating
 the certificate.  We might want to do this for an intermediate certificate for example.
 */
router.post('/validate', async (req, res, next) => {
  const { certificate, ethereumAddressSignature } = req.body;
  if (!certificate) next(new Error('Certificate was null or undefined'));
  if (!certificate.type === 'Buffer') next(new Error('Certificate is not a buffer'));
  try {
    const txDataToSign = await validateCertificate(
      Buffer.from(certificate.data),
      ethereumAddressSignature ? Buffer.from(ethereumAddressSignature) : null,
    );
    res.json(txDataToSign);
  } catch (err) {
    next(err);
  }
});

export default router;
