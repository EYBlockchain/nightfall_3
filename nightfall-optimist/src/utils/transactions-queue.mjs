import Queue from 'queue';

const txsQueue = new Queue({ autostart: true });

const txsQueueChallenger = new Queue({ autostart: true });

export { txsQueue, txsQueueChallenger };
