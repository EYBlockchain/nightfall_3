import { expose } from 'comlink';

import generateProof from '../nightfall-browser/utils/zokrates';

// eslint-disable-next-line no-undef
onconnect = event => expose(generateProof, event.ports[0]);
