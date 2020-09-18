import app from './app.js';
import rabbitmq from './utils/rabbitmq.js';
import queues from './queues/index.js';

const main = async () => {
  try {
    // 1 means enable it
    // 0 mean keep it disabled
    if (Number(process.env.ENABLE_QUEUE)) {
      await rabbitmq.connect();
      queues();
    }

    app.listen(80);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

main();
