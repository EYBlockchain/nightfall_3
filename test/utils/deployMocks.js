const { exec } = require('child_process');

exports.mochaGlobalSetup = async function (cd) {
  console.log(process.env);
  const prom = () =>
    new Promise(resolve =>
      exec(
        `cd ${cd || 'test/deploy-contracts'} && npx --yes truffle migrate`,
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
