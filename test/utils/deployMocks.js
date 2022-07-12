const { exec } = require('child_process');
const { ENVIRONMENTS } = require('config');
const path = require('path');

exports.mochaGlobalSetup = async function () {
  process.env.NODE_CONFIG_DIR = path.join(__dirname, '../../config');
  const environment = ENVIRONMENTS[process.env.ENVIRONMENT] || ENVIRONMENTS.localhost;

  const prom = () =>
    new Promise(resolve =>
      exec(
        `cd 'test/deploy-contracts' && npx --yes truffle migrate --to 2 --network=${environment.ethNetwork}`,
        (error, stdout, stderr) => {
          console.log(stdout);
          console.log(stderr);
          resolve();
          if (error !== null) console.log('exec error:', error);
        },
      ),
    );

  await prom();
};
