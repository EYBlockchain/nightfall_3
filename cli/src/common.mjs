import axios from 'axios';

const clientBaseUrl = 'http://localhost:8080';
export const optimistBaseUrl = 'http://localhost:8081';
export const web3WsUrl = 'ws://localhost:8546';
export const optimistWsUrl = 'ws://localhost:8082';

export async function submitTransaction(web3, unsignedTransaction, privateKey, shieldAddress, fee) {
  // if the nonce hasn't been set, then use the transaction count
  const accountAddress = web3.eth.accounts.privateKeyToAccount(privateKey);
  const nonce = await web3.eth.getTransactionCount(accountAddress.address);
  const tx = {
    to: shieldAddress,
    data: unsignedTransaction,
    value: fee,
    gas: 10000000,
    gasPrice: 10000000000,
    nonce,
  };
  const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
  return web3.eth.sendSignedTransaction(signed.rawTransaction);
}

export async function healthcheck(url) {
  if (!url) throw new Error('A base url must be specified for the healthcheck');
  let res;
  try {
    res = await axios.get(`${url}/healthcheck`);
    if (res.status !== 200) throw new Error();
  } catch (err) {
    console.log('\n**Server healthcheck failed**');
    process.exit(1);
  }
}

export async function getContractAddress(contractName) {
  const res = await axios.get(`${clientBaseUrl}/contract-address/${contractName}`);
  return res.data.address;
}
