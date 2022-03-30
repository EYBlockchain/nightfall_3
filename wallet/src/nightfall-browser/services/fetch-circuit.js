// ignore unused exports default

/*
 * can also be used as worker file to download circuits files from AWS (a worker thread).
 */

// import axios from 'axios';

import AWS from 'aws-sdk';

// const { s3Bucket } = global.config.AWS;
AWS.config.update({ accessKeyId: '', secretAccessKey: '' });
const s3 = new AWS.S3();

export default async function fetchCircuit(circuit, circuitsAWSFiles) {
  try {
    const fileSets = circuitsAWSFiles[circuit];
    if (!fileSets) throw Error('file sets missing');
    const returnObj = {};
    for (const key in fileSets) {
      if ({}.hasOwnProperty.call(fileSets, key)) {
        const res =
          // eslint-disable-next-line no-await-in-loop
          await s3
            .makeUnauthenticatedRequest('getObject', {
              Bucket: 'nightfallv3-testnet',
              Key: fileSets[key],
            })
            .promise();
        if (key === 'abi') returnObj[key] = JSON.parse(res.Body);
        else returnObj[key] = res.Body;

        // console.log(`signed circuit url ${JSON.stringify(returnObj[key])}`);
      }
    }
    console.log(returnObj);
    return returnObj;
  } catch (err) {
    console.log('Fail Fetch', err);
    console.error(err);
    return {};
  }
}
