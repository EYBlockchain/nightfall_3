import axios from 'axios';
import config from 'config';

const { optimistApiUrl } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

export async function getCurrentProposer() {
  const res = await axios.get(`${optimistApiUrl}/proposer/current-proposer`);
  return res.data.currentProposer;
}

export async function getProposers() {
  const res = await axios.get(`${optimistApiUrl}/proposer/proposers`);
  return res.data;
}

export async function registerProposer(keys) {
  const { address } = keys;
  const res = await axios.post(`${optimistApiUrl}/proposer/register`, {
    address,
    url: 'url',
  });
  if (res.data.txDataToSign === '') return false; // already registered

  //   return new Promise((resolve, reject) => {
  //       try {
  //         // estimate the gasPrice
  //         const gasPrice = await this.estimateGasPrice();
  //         // Estimate the gasLimit
  //         const gas = await this.estimateGas(contractAddress, unsignedTransaction);

  //         const tx = {
  //           from: this.ethereumAddress,
  //           to: contractAddress,
  //           data: unsignedTransaction,
  //           value: fee,
  //           gas,
  //           gasPrice,
  //         };

  //         if (this.ethereumSigningKey) {
  //           const signed = await this.web3.eth.accounts.signTransaction(tx, this.ethereumSigningKey);
  //           const promiseTest = new Promise((resolve, reject) => {
  //             this.web3.eth
  //               .sendSignedTransaction(signed.rawTransaction)
  //               .once('receipt', receipt => {
  //                 resolve(receipt);
  //               })
  //               .on('error', err => {
  //                 reject(err);
  //               });
  //           });
  //           return promiseTest;
  //         }
  //         return this.web3.eth.sendTransaction(tx);

  //       } catch (err) {
  //         reject(err);
  //       }
  //   });
}
