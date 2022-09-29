export async function estimateGas() {
  try {
    // Workaround to estimateGas call not working properly on Polygon Edge nodes
    const res = await axios.post(this.web3WsUrl, {
      method: 'eth_estimateGas',
      params: [
        {
          from: this.ethereumAddress,
          to: contractAddress,
          data: unsignedTransaction,
          value: this.defaultFee.toString(),
        },
      ],
    });
    if (res.data.error) throw new Error(res.data.error);
    gasLimit = parseInt(res.data.result, 16);
  } catch (error) {
    gasLimit = GAS; // backup if estimateGas failed
  }
  return Math.ceil(Number(gasLimit) * GAS_MULTIPLIER); // 50% seems a more than reasonable buffer.
}

export async function estimateGasPrice() {}
