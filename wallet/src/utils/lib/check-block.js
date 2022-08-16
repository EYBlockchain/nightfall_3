// ignore unused exports

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
  if (socket.readyState !== socket.OPEN) throw new Error(`Cannot open socket`);
  socket.send(JSON.stringify({ type: 'sync-timber', lastBlock: lastBlock - 1 }));
  socket.addEventListener('message', async function (event) {
    const parsed = JSON.parse(event.data);
    if (parsed.type === 'sync-timber') {
      if (parsed.historicalData[parsed.historicalData.length - 1].block.root !== lastTimber.root) {
        throw new Error(`Resync required`);
      }
    }
  });
}
