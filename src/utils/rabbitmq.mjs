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

  sendACK(message) {
    this.channel.ack(message);
  },

  /*
   * Consumer: receive message from a queue
   */
  async receiveMessage(queue, callback) {
    await this.channel.assertQueue(queue);
    this.channel.consume(queue, callback);
  },

  /*
   * function not in use.
   * close the channel and server connection.
   */
  async close() {
    await this.channel.close();
    await this.connection.close();
  },
};
