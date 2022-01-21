// utility to compress a pkd
import { generalise } from 'general-number';
import { compressPublicKey } from './nightfall-client/src/services/keys.mjs';

const inputs = generalise(process.argv.slice(2, 4));
console.log(`Compressed value = ${compressPublicKey(inputs).hex()}`);
