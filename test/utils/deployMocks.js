const { exec } = require('child_process');

const prom = () =>
  new Promise(resolve =>
    exec('cd test/deploy-contracts && npx --yes truffle migrate', (error, stdout, stderr) => {
      console.log(stdout);
      console.log(stderr);
      resolve();
      if (error !== null) console.log('exec error:', error);
    }),
  );

prom();
