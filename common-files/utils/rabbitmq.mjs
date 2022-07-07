import amqp from 'amqplib';

export default class RabbitMQ {
  constructor(url) {
    this.url = url;
  }

  // connect to RabbitMQ server.
  async connect() {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    this.channel.prefetch(1);
  }

  // publish message to a queue
  async sendMessage(queue, data, options = {}) {
    await this.channel.assertQueue(queue);
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), options);
  }

  async subscribe({ queue }, callback) {
    await this.channel.assertQueue(queue);

    if (callback) {
      this.channel.consume(queue, message => {
        callback(message, this);
        this.channel.ack(message);
      });
    }
    return this;
  }

  // only called from test-suite ./test/queue.mjs
  async close() {
    await this.channel.close();
    await this.connection.close();
  }
}
