import Queue from 'queue';

const txsQueue = new Queue({ autostart: true });

export default txsQueue;
