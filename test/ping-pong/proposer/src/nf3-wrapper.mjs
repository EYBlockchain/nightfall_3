import Nf3 from '../../../../cli/lib/nf3.mjs';

let nf3Instance = '';

function Nf3Instance(proposerEthereumSigningKey, Urls) {
  nf3Instance = new Nf3(proposerEthereumSigningKey, Urls);
  return nf3Instance;
}

async function sendOffchainTransaction(transaction) {
  if (nf3Instance !== '') {
    await nf3Instance.sendOffchainTransaction(transaction);
  }
}

async function getContractAddressOptimist(contract) {
  if (nf3Instance !== '') {
    const address = await nf3Instance.getContractAddressOptimist(contract);
    return address;
  } 
  return null;
}

export { Nf3Instance, sendOffchainTransaction, getContractAddressOptimist };
