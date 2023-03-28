import fs from 'fs';
import { signEthereumAddress } from './x509.mjs';
// function to sign an address, given an unecrypted key, PKCS#1 padding and an ethereum address.
function signAddress() {
  const { argv } = process;
  const privateKey = fs.readFileSync(argv[2]);
  const address = argv[3];
  console.log(signEthereumAddress(privateKey, address).toString('hex'));
}
signAddress();
