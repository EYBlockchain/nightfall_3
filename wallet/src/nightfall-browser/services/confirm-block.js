// ignore unused exports

import { emptyStoreBlocks, emptyStoreTimber } from './database';
import * as Storage from '../../utils/lib/local-storage';

const { eventWsUrl } = global.config;

const waitForOpenConnection = socket => {
  return new Promise((resolve, reject) => {
    const maxNumberOfAttempts = 10;
    const intervalTime = 200; // ms

    let currentAttempt = 0;
    const interval = setInterval(() => {
      if (currentAttempt > maxNumberOfAttempts - 1) {
        clearInterval(interval);
        reject(new Error('Maximum number of attempts exceeded'));
      } else if (socket.readyState === socket.OPEN) {
        clearInterval(interval);
        resolve();
      }
      currentAttempt++;
    }, intervalTime);
  });
};
export default async function confirmBlock(lastBlock, lastTimber) {
  const socket = new WebSocket(eventWsUrl);
  if (lastTimber.root === 0) return;
  await waitForOpenConnection(socket);
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify({ type: 'sync', lastBlock: lastBlock - 1, syncInfo: 'sync-timber' }));
  socket.addEventListener('message', async function (event) {
    const parsed = JSON.parse(event.data);
    if (parsed.type === 'sync-timber') {
      if (
        parsed.maxBlock === 1 ||
        parsed.historicalData[parsed.historicalData.length - 1].timber.root !== lastTimber.root
      ) {
        console.log('RESYNC DB');
        Storage.shieldAddressSet();
        emptyStoreBlocks();
        emptyStoreTimber();
      }
    }
  });
}
