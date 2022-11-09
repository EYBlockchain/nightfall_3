const swaggerAutogen = require('swagger-autogen')();

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
      description: 'URL to test',
    },
  ],
  host: 'localhost:8081',
  schemes: ['http'],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/routes/proposer.mjs'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(async () => {
  await import('./src/index.mjs');
});
