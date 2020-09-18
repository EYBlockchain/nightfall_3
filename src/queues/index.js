import loadCircuits from './loadCircuits.js';
import generateKeys from './generateKeys.js';
import generateProof from './generateProof.js';

export default function receiveMessage() {
  loadCircuits();
  generateKeys();
  generateProof();
}
