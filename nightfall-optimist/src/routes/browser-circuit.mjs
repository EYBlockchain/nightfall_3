import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import AWS from 'aws-sdk';
import config from 'config';

AWS.config.update({
  accessKeyId: 'AKIA52WWLUYZ3YIMPDPE',
  secretAccessKey: '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',
});

const s3 = new AWS.S3();

const myBucket = 'nightfallv3';
const { circuitsAWSFiles } = config;

const router = express.Router();

router.get('/:circuit', async (req, res, next) => {
  const { circuit } = req.params;
  logger.debug(`AWS get URL for ${circuit} circuit endpoint received GET`);
  try {
    const fileSets = circuitsAWSFiles[circuit];
    if (!fileSets) throw Error('file sets missing');

    const returnObj = {};
    for (const key in fileSets) {
      if ({}.hasOwnProperty.call(fileSets, key)) {
        // eslint-disable-next-line no-await-in-loop
        returnObj[key] = await s3.getSignedUrlPromise('getObject', {
          Bucket: myBucket,
          Key: fileSets[key],
          Expires: 60 * 20, // your expiry time in seconds.
        });
        logger.debug(`signed circuit url ${returnObj[key]}`);
      }
    }

    res.json(returnObj);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
