import express from 'express';
import AWS from 'aws-sdk';
import config from 'config';

const { accessKeyId, secretAccessKey } = config.AWS;
AWS.config.update({ accessKeyId, secretAccessKey });
const s3 = new AWS.S3();

const myBucket = 'nightfallv3';
const { circuitsAWSFiles } = config;

const router = express.Router();

router.get('/:circuit', async (req, res, next) => {
  const { circuit } = req.params;
  console.log(`AWS get URL for ${circuit} circuit endpoint received GET`);
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
        console.log(`signed circuit url ${returnObj[key]}`);
      }
    }

    res.json(returnObj);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

export default router;
