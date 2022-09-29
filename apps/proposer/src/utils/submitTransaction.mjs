import { estimateGasPrice, estimateGas } from '../services/gas.mjs';
import { web3 } from '../classes/web3.mjs';
import { address, privateKey } from '../classes/keys.mjs';
import { contracts } from '../classes/contracts.mjs';

export default async function submitTransaction({
  from = address,
  to = contracts.proposers,
  data,
  value = 0,
}) {
  try {
    // estimate the gasPrice and gas limit
    const gasPrice = await estimateGasPrice();
    const gas = await estimateGas(address, data);

    const tx = {
      from,
      to,
      data,
      value,
      gas,
      gasPrice,
    };

    const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
    const promiseTest = new Promise((resolve, reject) => {
      web3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once('receipt', receipt => {
          console.log('receipt', receipt);
          resolve(receipt);
        })
        .on('error', err => {
          reject(err);
        });
    });
    return promiseTest;
  } catch (err) {
    throw new Error(err);
  }
}
