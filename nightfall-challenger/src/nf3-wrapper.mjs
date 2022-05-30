import Nf3 from '../../cli/lib/nf3.mjs';

let nf3Instance = '';

async function nf3SendOffchainTransaction(transaction) {
  if (nf3Instance !== '') {
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

async function nf3Init(challengerEthereumSigningKey, Urls, mnemonic, contractAddressProvider) {
  nf3Instance = new Nf3(challengerEthereumSigningKey, Urls);
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

async function nf3RegisterChallenger() {
  if (nf3Instance !== '') {
    const res = await nf3Instance.registerChallenger();
    return res;
  }
  return false;
}

async function nf3StartChallenger() {
  if (nf3Instance !== '') {
    const res = await nf3Instance.startChallenger();
    return res;
  }
  return false;
}

export {
  nf3SendOffchainTransaction,
  nf3GetContractAddressOptimist,
  nf3Init,
  nf3Healthcheck,
  nf3RegisterChallenger,
  nf3StartChallenger,
};
