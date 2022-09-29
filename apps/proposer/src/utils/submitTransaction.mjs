export default async function submitTransaction(
  unsignedTransaction,
  contractAddress = this.shieldContractAddress,
  fee,
) {
  // estimate the gasPrice
  const gasPrice = await this.estimateGasPrice();
  // Estimate the gasLimit
  const gas = await this.estimateGas(contractAddress, unsignedTransaction);
  const tx = {
    from: this.ethereumAddress,
    to: contractAddress,
    data: unsignedTransaction,
    value: fee,
    gas,
    gasPrice,
  };

  if (this.ethereumSigningKey) {
    const signed = await this.web3.eth.accounts.signTransaction(tx, this.ethereumSigningKey);
    const promiseTest = new Promise((resolve, reject) => {
      this.web3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once('receipt', receipt => {
          resolve(receipt);
        })
        .on('error', err => {
          reject(err);
        });
    });
    return promiseTest;
  }
  return this.web3.eth.sendTransaction(tx);
}
