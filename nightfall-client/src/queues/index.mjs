import deposit from './deposit.mjs';
import transfer from './transfer.mjs';
import withdraw from './withdraw.mjs';
import tokenise from './tokenise.mjs';
import burn from './burn.mjs';

export default function receiveMessage() {
  deposit();
  transfer();
  withdraw();
  tokenise();
  burn();
}
