import Nf3 from '../../../cli/lib/nf3.mjs';

let nf3Instance = '';

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

export { nf3Init, nf3Healthcheck, nf3RegisterChallenger, nf3StartChallenger };
