/* ignore unused exports */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const constants = require('./constants.json');
const bigInts = require('./bigInts.js');

export default { ...constants, ...bigInts };
