const https = require('https');

function getRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      let rawData = '';

      res.on('data', chunk => {
        rawData += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (err) {
          reject(new Error(err));
        }
      });
    });

    req.on('error', err => {
      reject(new Error(err));
    });
  });
}

exports.handler = async () => {
  try {
    console.log('ETH_GAS_STATION', process.env.ETH_GAS_STATION);
    const result = await getRequest(
      `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETH_GAS_STATION}`,
    );
    console.log('result', result);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.log('Error is️:', error);
    return {
      statusCode: 400,
      body: error.message,
    };
  }
};
