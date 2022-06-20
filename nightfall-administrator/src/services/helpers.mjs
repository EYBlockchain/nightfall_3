import config from 'config';
import Queue from 'queue';
import logger from '../../../common-files/utils/logger.mjs';
import { web3 } from '../../../common-files/utils/contract.mjs';

const { RESTRICTIONS, WEB3_OPTIONS } = config;
const transactionQueue = new Queue({ autostart: true, concurrency: 1 });

/**
Read the names of tokens from the config
*/
export function getTokenNames() {
  const tokenNames = [];
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    tokenNames.push(token.name);
  }
  return tokenNames;
}

export function getTokenAddress(tokenName) {
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) return token.address;
  }
  return 'unknown';
}

export function queueTransaction(unsignedTransaction, signingKey, contractAddress) {
  transactionQueue.push(async () => {
    const tx = {
      from: web3.eth.accounts.privateKeyToAccount(signingKey).address,
      to: contractAddress,
      data: unsignedTransaction,
      gas: WEB3_OPTIONS.gas,
      gasPrice: await web3.eth.getGasPrice(),
    };
    const signed = await web3.eth.accounts.signTransaction(tx, signingKey);
    return new Promise(resolve => {
      web3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once('receipt', receipt => {
          logger.debug(`Transaction ${receipt.transactionHash} has been received.`);
          resolve(receipt);
        })
        .on('error', err => {
          logger.error(err.message);
          resolve(false);
        });
    });
  });
}
