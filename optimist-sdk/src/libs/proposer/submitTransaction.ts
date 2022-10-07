export default async function submitTransaction({
  from = this.address,
  to = this.contracts.proposers,
  data,
  value = this.defaults.fee,
}) {
  // estimate the gasPrice and gas limit
  const gasPriceEstimation = await this.gas.estimateGasPrice();
  const gasEstimation = await this.gas.estimateGas(from, data);

  const tx = {
    from,
    to,
    data,
    value,
    gas: gasEstimation,
    gasPrice: gasPriceEstimation,
  };

  const signed = await this.web3.eth.accounts.signTransaction(tx, this.privateKey);
  const promiseTest = new Promise((resolve, reject) => {
    this.web3.eth
      .sendSignedTransaction(signed?.rawTransaction)
      .once('receipt', async receipt => {
        console.log('receipt', receipt);
        resolve(receipt);
      })
      .on('error', err => {
        reject(err);
      });
  });

  return promiseTest;
}
