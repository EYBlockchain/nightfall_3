import amqp from 'amqplib';

export default {
  // connect to RabbitMQ server.
  async connect() {
    this.connection = await amqp.connect(
      `${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`,
    );
    this.channel = await this.connection.createChannel();
    this.channel.prefetch(1);
  },

  // publish message to a queue
  async sendMessage(queue, data, options = {}) {
    await this.channel.assertQueue(queue);
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), options);
  },

  // only called from test-suite ./test/queue.mjs
  cancelChannelConsume(consumerTag) {
    this.channel.cancel(consumerTag);
  },

  sendACK(message) {
    this.channel.ack(message);
  },

  // only called from test-suite ./test/queue.mjs
  sendNACK(message) {
    this.channel.nack(message);
  },

  /*
   * Consumer: receive message from a queue
   */
  async receiveMessage(queue, callback) {
    await this.channel.assertQueue(queue);
    this.channel.consume(queue, callback);
  },

  // only called from test-suite ./test/queue.mjs
  listenToReplyQueue(queue, correlationId, callback) {
    this.receiveMessage(queue, async message => {
      if (message.properties.correlationId !== correlationId) {
        return this.sendNACK(message);
      }

      this.sendACK(message);
      await this.cancelChannelConsume(message.fields.consumerTag);

      const response = JSON.parse(message.content.toString());
      if (response.error) {
        throw Error(response.error);
      }

      return callback(response.data);
    });
  },

  // only called from test-suite ./test/queue.mjs
  async close() {
    await this.channel.close();
    await this.connection.close();
  },
};
