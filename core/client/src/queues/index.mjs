import deposit from './deposit.mjs';
import transfer from './transfer.mjs';
import withdraw from './withdraw.mjs';

export default function receiveMessage() {
  deposit();
  transfer();
  withdraw();
}
