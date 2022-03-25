import Nf3 from '../../lib/nf3.mjs';

let nf3Instance = '';

async function nf3SendOffchainTransaction(transaction) {
  if (nf3Instance !== '') {
    const validPayment = await nf3Instance.checkPayment(
      transaction.transactionHash,
      transaction.fee,
    );

    if (!validPayment)
      throw new Error(
        `No valid payment to send off-chain transaction ${transaction.transactionHash}`,
      );
    await nf3Instance.sendOffchainTransaction(transaction);
  }
}

async function nf3GetContractAddressOptimist(contract) {
  if (nf3Instance !== '') {
    const address = await nf3Instance.getContractAddressOptimist(contract);
    return address;
  }
  return null;
}

async function nf3Init(proposerEthereumSigningKey, Urls, mnemonic, contractAddressProvider) {
  nf3Instance = new Nf3(proposerEthereumSigningKey, Urls);
  if (nf3Instance !== '') {
    await nf3Instance.init(mnemonic, contractAddressProvider);
  }
}

async function nf3Healthcheck(server) {
  if (nf3Instance !== '') {
    const res = await nf3Instance.healthcheck(server);
    return res;
  }
  return false;
}

async function nf3RegisterProposer(url) {
  if (nf3Instance !== '') {
    const res = await nf3Instance.registerProposer(url);
    return res;
  }
  return false;
}

async function nf3StartProposer() {
  if (nf3Instance !== '') {
    const res = await nf3Instance.startProposer();
    return res;
  }
  return false;
}

export {
  nf3SendOffchainTransaction,
  nf3GetContractAddressOptimist,
  nf3Init,
  nf3Healthcheck,
  nf3RegisterProposer,
  nf3StartProposer,
};
