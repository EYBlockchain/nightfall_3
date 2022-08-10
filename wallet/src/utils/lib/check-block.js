// ignore unused exports

const { eventWsUrl } = global.config;

export default function confirmBlock(lastBlock) {
  const socket = new WebSocket(eventWsUrl);

  // Connection opened
  socket.addEventListener('open', async function () {
    socket.send(JSON.stringify({ type: 'sync', lastBlock }));
  });
}
