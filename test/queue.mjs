import chai from 'chai';
import fs from 'fs';

import rabbitmq from '../src/utils/rabbitmq.mjs';

const fileToBuffer = filename => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filename);
    const chunks = [];

    // Handle any errors while reading
    readStream.on('error', err => {
      return reject(err);
    });

    // Listen for data
    readStream.on('data', chunk => {
      chunks.push(chunk);
    });

    // File is done being read
    readStream.on('close', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

const generateUuid = () => `${Math.random().toString()}
  ${Math.random().toString()}
  ${Math.random().toString()}`;

const { expect } = chai;
let file;

const env = process.env;
env.RABBITMQ_HOST = 'amqp://localhost';
env.RABBITMQ_PORT = '5672';

process.on('unhandledRejection', () => {});

describe('Testing the Zokrates queue mechanism', () => {
  
  before(async () => {
    await rabbitmq.connect();
    file = {
      name: 'multiple.tar',
      data: (await fileToBuffer('./circuits/test/multiple.tar')).toString(),
    };

  });

  after(() => rabbitmq.close());

  it('should load a zokrates file', done => {
    const correlationId = generateUuid();
    const queue = 'load-circuits';
    const replyTo = `${queue}-reply`; // replyTo queue

    rabbitmq.sendMessage(queue, file, {
      correlationId,
      replyTo,
    });

    rabbitmq.listenToReplyQueue(replyTo, correlationId, data => {
      expect(data.message).to.equal('Circuits loadded successfully');
      done();
    });
  });

  it('should generate a proving and verifying keys (trusted setup) and return the verifying key', done => {
    const correlationId = generateUuid();
    const queue = 'generate-keys';
    const replyTo = `${queue}-reply`; // replyTo queue

    rabbitmq.sendMessage(
      queue,
      {
        filepath: 'factor.zok',
        curve: 'bn128',
        provingScheme: 'gm17',
        backend: 'libsnark',
      },
      {
        correlationId,
        replyTo,
      },
    );

    rabbitmq.listenToReplyQueue(replyTo, correlationId, data => {
      expect(data).to.have.property('vk');
      expect(data.vk).to.have.property('raw');
      expect(data.vk.h).to.be.instanceof(Array);
      done();
    });
  });

  it('should generate a proof', done => {
    const correlationId = generateUuid();
    const queue = 'generate-proof';
    const replyTo = `${queue}-reply`; // replyTo queue

    rabbitmq.sendMessage(
      queue,
      {
        folderpath: 'factor',
        inputs: [6, 3, 2],
        provingScheme: 'gm17',
        backend: 'libsnark',
      },
      {
        correlationId,
        replyTo,
      },
    );

    rabbitmq.listenToReplyQueue(replyTo, correlationId, data => {
      expect(data).to.have.property('proof');
      expect(data.proof).to.have.property('a');
      expect(data.proof).to.have.property('b');
      expect(data.proof).to.have.property('c');
      expect(data.proof.a).to.be.instanceof(Array);
      done();
    });
  });
});
