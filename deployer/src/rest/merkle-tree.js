import request from 'request';
import config from 'config';

const host = `${config.merkleTree.host}:${config.merkleTree.port}`;

const getContractAddress = () => {
  return new Promise((resolve, reject) => {
    const options = {
      url: `${host}/metadata/contractAddress`,
      method: 'GET',
      json: true,
      body: {},
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
};

export default {
  getContractAddress,
};
