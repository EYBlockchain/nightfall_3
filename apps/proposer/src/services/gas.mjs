import { address, defaults, web3 } from '../classes/web3.mjs';
import { estimateGasUrl, blockchain } from '../classes/http.mjs';

export async function estimateGas(toAddress, tx) {
  let gasLimit;
  try {
    // Workaround to estimateGas call not working properly on Polygon Edge nodes
    const { data } = await blockchain.post({
      method: 'eth_estimateGas',
      params: [
        {
          from: address,
          to: toAddress,
          data: tx,
          value: defaults.fee.toString(),
        },
      ],
    });
    if (data.error) throw new Error(data.error);
    gasLimit = parseInt(data.result, 16);
  } catch (error) {
    gasLimit = defaults.gas; // backup if estimateGas failed
  }
  return Math.ceil(Number(gasLimit) * 2); // 50% seems a more than reasonable buffer.
}

export async function estimateGasPrice() {
  let proposedGasPrice;
  try {
    // Call the endpoint to estimate the gas fee.
    const { data } = await estimateGasUrl.get();
    proposedGasPrice = Number(data?.result?.ProposeGasPrice) * 10 ** 9;
  } catch (error) {
    try {
      proposedGasPrice = Number(await web3.eth.getGasPrice());
    } catch (err) {
      proposedGasPrice = defaults.gasPrice;
    }
  }
  return Math.ceil(proposedGasPrice * 2);
}
