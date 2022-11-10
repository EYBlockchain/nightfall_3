const swaggerAutogen = require('swagger-autogen');

console.log('autogen', swaggerAutogen);

const doc = {
  info: {
    version: '1.0.0',
    title: 'Nightfall Optimist API',
    description: 'This API is used by proposers',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      email: 'nightfalladmin@polygon.technology ',
    },
  },
  servers: [
    {
      url: 'http://localhost:8081',
      description: 'Dev',
    },
  ],
  definitions: {
    TxDataToSign: {
      txDataToSign:
        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
    },
    Proposer: {
      url: 'http://test-proposer1',
      stake: 0,
      fee: 0,
    },
    CurrentProposerResponse: {
      currentProposer: '0x0000000000000000000000000000000000000000',
    },
    AllProposers: [
      {
        0: '0x0000000000000000000000000000000000000000',
        1: '0x0000000000000000000000000000000000000000',
        2: '0x0000000000000000000000000000000000000000',
        3: '',
        4: '0',
        5: false,
        6: '0',
        thisAddress: '0x0000000000000000000000000000000000000000',
        previousAddress: '0x0000000000000000000000000000000000000000',
        nextAddress: '0x0000000000000000000000000000000000000000',
        url: '',
        fee: '0',
        inProposerSet: false,
        indexProposerSet: '0',
      },
    ],
  },
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/routes/proposer.mjs'];

swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointsFiles, doc).then(async () => {
  await import('./src/index.mjs');
});
